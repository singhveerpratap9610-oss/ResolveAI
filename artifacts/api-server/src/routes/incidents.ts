import { and, count, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AnalyzeIncidentBody,
  AnalyzeIncidentParams,
  AnalyzeIncidentResponse,
  CreateIncidentBody,
  CreateIncidentResponse,
  DeleteIncidentParams,
  GetDashboardResponse,
  GetIncidentEventsParams,
  GetIncidentEventsResponse,
  GetIncidentParams,
  GetIncidentResponse,
  ListCategoriesResponse,
  ListIncidentsQueryParams,
  ListIncidentsResponse,
  ResolveIncidentBody,
  ResolveIncidentParams,
  ResolveIncidentResponse,
  UpdateIncidentBody,
  UpdateIncidentParams,
  UpdateIncidentResponse,
} from "@workspace/api-zod";
import {
  db,
  incidentEventsTable,
  incidentsTable,
  type Incident,
} from "@workspace/db";
import {
  analyzeHistoricalIncident,
  isHistoricalClassifierReady,
  listHistoricalCategories,
} from "../lib/historical-classifier";

const router: IRouter = Router();

function toApiIncident(incident: Incident) {
  return {
    ...incident,
    predictedCategory: incident.predictedCategory ?? null,
    category: incident.category ?? null,
    confidence:
      incident.confidence === null ? null : Number(incident.confidence),
    reporterEmail: incident.reporterEmail ?? null,
    assignedTo: incident.assignedTo ?? null,
    resolution: incident.resolution ?? null,
    resolutionMethod: incident.resolutionMethod ?? null,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
  };
}

function toApiEvent(event: typeof incidentEventsTable.$inferSelect) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
  };
}

function parseId(
  rawParams: Record<string, string | string[] | undefined>,
  schema:
    | typeof GetIncidentParams
    | typeof UpdateIncidentParams
    | typeof DeleteIncidentParams
    | typeof AnalyzeIncidentParams
    | typeof ResolveIncidentParams
    | typeof GetIncidentEventsParams,
  req: Parameters<Parameters<IRouter["get"]>[1]>[0],
  res: Parameters<Parameters<IRouter["get"]>[1]>[1],
): number | null {
  const params = schema.safeParse(rawParams);
  if (!params.success) {
    res.status(400).json({ error: "Invalid incident ID" });
    return null;
  }
  return params.data.id;
}

router.get("/incidents", async (req, res): Promise<void> => {
  const parsed = ListIncidentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid incident filters" });
    return;
  }

  const filters = [];
  if (parsed.data.search?.trim()) {
    const search = `%${parsed.data.search.trim().replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(
      sql`(${ilike(incidentsTable.title, search)} OR ${ilike(incidentsTable.description, search)})`,
    );
  }
  if (parsed.data.status) {
    filters.push(eq(incidentsTable.status, parsed.data.status));
  }
  if (parsed.data.priority) {
    filters.push(eq(incidentsTable.priority, parsed.data.priority));
  }
  if (parsed.data.category) {
    filters.push(eq(incidentsTable.category, parsed.data.category));
  }
  const where = filters.length ? and(...filters) : undefined;
  const limit = parsed.data.limit ?? 25;
  const offset = parsed.data.offset ?? 0;

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(incidentsTable)
      .where(where)
      .orderBy(desc(incidentsTable.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(incidentsTable).where(where),
  ]);

  res.json(
    ListIncidentsResponse.parse({
      results: rows.map(toApiIncident),
      total: totals[0]?.total ?? 0,
      limit,
      offset,
    }),
  );
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isHistoricalClassifierReady()) {
    res.status(503).json({
      error: "Historical classifier unavailable; incident was not created.",
    });
    return;
  }

  const analysis = analyzeHistoricalIncident(
    parsed.data.title,
    parsed.data.description,
  );
  const incident = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(incidentsTable)
      .values({
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        priority: parsed.data.priority,
        reporterEmail: parsed.data.reporterEmail ?? null,
        assignedTo: parsed.data.assignedTo?.trim() || null,
        predictedCategory: analysis.predictedCategory,
        category: analysis.predictedCategory,
        confidence: analysis.confidence,
      })
      .returning();
    await tx.insert(incidentEventsTable).values({
      incidentId: created.id,
      eventType: "reported",
      message: "Incident reported and classified using historical ticket evidence.",
    });
    return created;
  });

  req.log.info({ incidentId: incident.id }, "Incident reported");
  res.status(201).json(CreateIncidentResponse.parse(toApiIncident(incident)));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const categoryExpression = sql<string>`coalesce(${incidentsTable.category}, 'Unclassified')`;
  const [statusRows, priorityRows, categoryRows, recentRows] = await Promise.all([
    db
      .select({ label: incidentsTable.status, value: count() })
      .from(incidentsTable)
      .groupBy(incidentsTable.status),
    db
      .select({ label: incidentsTable.priority, value: count() })
      .from(incidentsTable)
      .groupBy(incidentsTable.priority),
    db
      .select({ label: categoryExpression, value: count() })
      .from(incidentsTable)
      .groupBy(categoryExpression),
    db
      .select()
      .from(incidentsTable)
      .orderBy(desc(incidentsTable.updatedAt))
      .limit(8),
  ]);
  const statusCount = (status: string) =>
    statusRows.find((row) => row.label === status)?.value ?? 0;
  const summary = {
    total: statusRows.reduce((sum, row) => sum + row.value, 0),
    open: statusCount("open"),
    inProgress: statusCount("in_progress"),
    resolved: statusCount("resolved") + statusCount("closed"),
    escalated: statusCount("escalated"),
    byPriority: priorityRows.map(({ label, value }) => ({ label, count: value })),
    byCategory: categoryRows.map(({ label, value }) => ({ label, count: value })),
    recentIncidents: recentRows.map(toApiIncident),
  };
  res.json(GetDashboardResponse.parse(summary));
});

router.get("/categories", async (_req, res): Promise<void> => {
  const historical = listHistoricalCategories();
  const live = await db
    .select({ name: incidentsTable.category })
    .from(incidentsTable)
    .where(isNotNull(incidentsTable.category))
    .groupBy(incidentsTable.category);
  const counts = new Map(
    historical.map(({ name, historicalCount }) => [name, historicalCount]),
  );
  for (const category of live) {
    if (category.name) counts.set(category.name, counts.get(category.name) ?? 0);
  }
  res.json(
    ListCategoriesResponse.parse(
      Array.from(counts, ([name, historicalCount]) => ({
        name,
        historicalCount,
      })).sort((left, right) => right.historicalCount - left.historicalCount),
    ),
  );
});

router.post("/incidents/:id/analyze", async (req, res): Promise<void> => {
  const id = parseId(req.params, AnalyzeIncidentParams, req, res);
  if (id === null) return;
  const input = AnalyzeIncidentBody.safeParse(req.body ?? {});
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  if (!isHistoricalClassifierReady()) {
    res.status(503).json({ error: "Historical classifier is unavailable." });
    return;
  }

  const [current] = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.id, id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }

  const analysis = analyzeHistoricalIncident(
    current.title,
    current.description,
    input.data.similarLimit,
  );
  const category =
    current.category === current.predictedCategory || current.category === null
      ? analysis.predictedCategory
      : current.category;
  const [updated] = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(incidentsTable)
      .set({
        predictedCategory: analysis.predictedCategory,
        category,
        confidence: analysis.confidence,
        status: current.status === "open" ? "in_progress" : current.status,
      })
      .where(eq(incidentsTable.id, id))
      .returning();
    await tx.insert(incidentEventsTable).values({
      incidentId: id,
      eventType: "analysis",
      message: `Historical ticket analysis completed. Predicted category: ${analysis.predictedCategory}.`,
    });
    return [result];
  });

  res.json(
    AnalyzeIncidentResponse.parse({
      incident: toApiIncident(updated),
      ...analysis,
    }),
  );
});

router.post("/incidents/:id/resolve", async (req, res): Promise<void> => {
  const id = parseId(req.params, ResolveIncidentParams, req, res);
  if (id === null) return;
  const parsed = ResolveIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [current] = await db
    .select({ id: incidentsTable.id })
    .from(incidentsTable)
    .where(eq(incidentsTable.id, id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  const resolvedAt = parsed.data.verified ? new Date() : null;
  const [updated] = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(incidentsTable)
      .set({
        resolution: parsed.data.resolution.trim(),
        resolutionVerified: parsed.data.verified,
        resolutionMethod: parsed.data.verified
          ? "Human-verified"
          : "Resolution note; verification pending",
        status: parsed.data.verified ? "resolved" : "in_progress",
        resolvedAt,
      })
      .where(eq(incidentsTable.id, id))
      .returning();
    await tx.insert(incidentEventsTable).values({
      incidentId: id,
      eventType: parsed.data.verified ? "resolved" : "resolution_note",
      message: parsed.data.verified
        ? "Resolution recorded and verified by an operator."
        : "Resolution note saved; verification is still pending.",
    });
    return [result];
  });

  res.json(ResolveIncidentResponse.parse(toApiIncident(updated)));
});

router.get("/incidents/:id/events", async (req, res): Promise<void> => {
  const id = parseId(req.params, GetIncidentEventsParams, req, res);
  if (id === null) return;
  const [exists] = await db
    .select({ id: incidentsTable.id })
    .from(incidentsTable)
    .where(eq(incidentsTable.id, id))
    .limit(1);
  if (!exists) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  const events = await db
    .select()
    .from(incidentEventsTable)
    .where(eq(incidentEventsTable.incidentId, id))
    .orderBy(incidentEventsTable.createdAt);
  res.json(GetIncidentEventsResponse.parse(events.map(toApiEvent)));
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params, GetIncidentParams, req, res);
  if (id === null) return;
  const [incident] = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.id, id))
    .limit(1);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(GetIncidentResponse.parse(toApiIncident(incident)));
});

router.patch("/incidents/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params, UpdateIncidentParams, req, res);
  if (id === null) return;
  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "At least one incident field is required." });
    return;
  }

  const [current] = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.id, id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  if (
    (parsed.data.status === "resolved" || parsed.data.status === "closed") &&
    !current.resolutionVerified
  ) {
    res.status(400).json({
      error: "Record and verify a resolution before resolving or closing.",
    });
    return;
  }

  const reopening =
    parsed.data.status === "open" || parsed.data.status === "in_progress";
  const [updated] = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(incidentsTable)
      .set({
        ...parsed.data,
        ...(reopening
          ? {
              resolutionVerified: false,
              resolvedAt: null,
              resolutionMethod: current.resolution
                ? "Resolution note; verification pending"
                : current.resolutionMethod,
            }
          : {}),
      })
      .where(eq(incidentsTable.id, id))
      .returning();
    const changedStatus = parsed.data.status;
    await tx.insert(incidentEventsTable).values({
      incidentId: id,
      eventType: changedStatus ? "status_change" : "updated",
      message: changedStatus
        ? `Incident status changed to ${changedStatus.replace("_", " ")}.`
        : "Incident details updated.",
    });
    return [result];
  });

  res.json(UpdateIncidentResponse.parse(toApiIncident(updated)));
});

router.delete("/incidents/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params, DeleteIncidentParams, req, res);
  if (id === null) return;
  const [deleted] = await db
    .delete(incidentsTable)
    .where(eq(incidentsTable.id, id))
    .returning({ id: incidentsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
