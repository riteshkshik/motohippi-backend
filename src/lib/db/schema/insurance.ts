import { pgTable, serial, text, integer, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users.js";

export const insurancePlansTable = pgTable("insurance_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  premium: numeric("premium").notNull(),
  coverage: numeric("coverage"),
  features: jsonb("features").$type<string[]>().default([]),
  duration: text("duration").notNull(),
  rating: numeric("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insurancePoliciesTable = pgTable("insurance_policies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").notNull().references(() => insurancePlansTable.id),
  planName: text("plan_name").notNull(),
  type: text("type").notNull(),
  status: text("status").default("active").notNull(),
  policyNumber: text("policy_number").notNull(),
  premium: numeric("premium").notNull(),
  coverage: numeric("coverage"),
  provider: text("provider").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertInsurancePlanSchema = createInsertSchema(insurancePlansTable).omit({ id: true, createdAt: true });
export type InsertInsurancePlan = z.infer<typeof insertInsurancePlanSchema>;
export type InsurancePlan = typeof insurancePlansTable.$inferSelect;
