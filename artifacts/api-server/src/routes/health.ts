import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isHistoricalClassifierReady } from "../lib/historical-classifier";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  let databaseReady = false;
  try {
    await db.execute(sql`select 1`);
    databaseReady = true;
  } catch {
    databaseReady = false;
  }
  const classifierReady = isHistoricalClassifierReady();
  const data = HealthCheckResponse.parse({
    status: databaseReady && classifierReady ? "ok" : "degraded",
    database: databaseReady ? "connected" : "unavailable",
    classifier: classifierReady ? "ready" : "unavailable",
  });
  res.json(data);
});

export default router;
