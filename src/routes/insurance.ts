import { Router } from "express";
import { db } from "../lib/db/index.js";
import { insurancePlansTable, insurancePoliciesTable } from "../lib/db/index.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { PurchaseInsuranceBody } from "../lib/api-zod/index.js";
import crypto from "crypto";

const router = Router();

function formatPlan(p: typeof insurancePlansTable.$inferSelect) {
  return {
    id: p.id, name: p.name, type: p.type, provider: p.provider,
    premium: parseFloat(p.premium),
    coverage: p.coverage ? parseFloat(p.coverage) : null,
    features: (p.features as string[]) || [],
    duration: p.duration, rating: p.rating ? parseFloat(p.rating) : null,
  };
}

router.get("/insurance/plans", authMiddleware, async (req, res) => {
  const type = req.query.type as string;
  const plans = type
    ? await db.select().from(insurancePlansTable).where(eq(insurancePlansTable.type, type)).limit(50)
    : await db.select().from(insurancePlansTable).limit(50);
  res.json(plans.map(formatPlan));
});

router.get("/insurance/policies", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const policies = await db.select().from(insurancePoliciesTable).where(eq(insurancePoliciesTable.userId, userId));
  res.json(policies.map(p => ({
    id: p.id, planName: p.planName, type: p.type, status: p.status,
    policyNumber: p.policyNumber, premium: parseFloat(p.premium),
    coverage: p.coverage ? parseFloat(p.coverage) : null,
    provider: p.provider,
    startedAt: p.startedAt.toISOString(), expiresAt: p.expiresAt.toISOString(),
  })));
});

router.post("/insurance/policies", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const result = PurchaseInsuranceBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { planId } = result.data;
  const [plan] = await db.select().from(insurancePlansTable).where(eq(insurancePlansTable.id, planId)).limit(1);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const [policy] = await db.insert(insurancePoliciesTable).values({
    userId, planId, planName: plan.name, type: plan.type,
    policyNumber: `MH${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    premium: plan.premium, coverage: plan.coverage, provider: plan.provider, expiresAt,
  }).returning();
  if (!policy) { res.status(500).json({ error: "Failed to create policy" }); return; }
  res.status(201).json({
    id: policy.id, planName: policy.planName, type: policy.type, status: policy.status,
    policyNumber: policy.policyNumber, premium: parseFloat(policy.premium),
    coverage: policy.coverage ? parseFloat(policy.coverage) : null,
    provider: policy.provider,
    startedAt: policy.startedAt.toISOString(), expiresAt: policy.expiresAt.toISOString(),
  });
});

export default router;
