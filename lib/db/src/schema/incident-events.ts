import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { incidentsTable } from "./incidents";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const incidentEventsTable = pgTable("incident_events", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id")
    .notNull()
    .references(() => incidentsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const incidentRelations = relations(incidentsTable, ({ many }) => ({
  events: many(incidentEventsTable),
}));

export const incidentEventsRelations = relations(
  incidentEventsTable,
  ({ one }) => ({
    incident: one(incidentsTable, {
      fields: [incidentEventsTable.incidentId],
      references: [incidentsTable.id],
    }),
  }),
);

export const insertIncidentEventSchema = createInsertSchema(
  incidentEventsTable,
).omit({ id: true, createdAt: true });

export type InsertIncidentEvent = z.infer<typeof insertIncidentEventSchema>;
export type IncidentEventRecord = typeof incidentEventsTable.$inferSelect;
