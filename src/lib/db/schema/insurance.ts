import { pgTable, serial, text, integer, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

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

export const insuranceInquiriesTable = pgTable("insurance_inquiries", {
  id: serial("id").primaryKey(),
  vehicleCategory: text("vehicle_category").notNull(),
  insuranceRequirement: text("insurance_requirement").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  yearOfPurchase: text("year_of_purchase"),
  kmsDriven: text("kms_driven"),
  city: text("city"),
  fullName: text("full_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  email: text("email"),
  preferredTime: text("preferred_time"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInsurancePlanSchema = createInsertSchema(insurancePlansTable).omit({ id: true, createdAt: true });
export type InsertInsurancePlan = z.infer<typeof insertInsurancePlanSchema>;
export type InsurancePlan = typeof insurancePlansTable.$inferSelect;

export const insertInsuranceInquirySchema = createInsertSchema(insuranceInquiriesTable).omit({ id: true, createdAt: true, status: true });
export type InsertInsuranceInquiry = z.infer<typeof insertInsuranceInquirySchema>;
export type InsuranceInquiry = typeof insuranceInquiriesTable.$inferSelect;

