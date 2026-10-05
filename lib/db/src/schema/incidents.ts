import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "in_progress",
  "resolved",
  "escalated",
  "closed",
]);

export const incidentPriorityEnum = pgEnum("incident_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: incidentStatusEnum("status").notNull().default("open"),
  priority: incidentPriorityEnum("priority").notNull().default("medium"),
  predictedCategory: text("predicted_category"),
  category: text("category"),
  confidence: real("confidence"),
  reporterEmail: text("reporter_email"),
  assignedTo: text("assigned_to"),
  resolution: text("resolution"),
  resolutionMethod: text("resolution_method"),
  resolutionVerified: boolean("resolution_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
