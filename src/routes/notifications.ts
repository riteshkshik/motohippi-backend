import { Router } from "express";
import { db } from "../lib/db/index.js";
import { notificationsTable } from "../lib/db/index.js";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";

const router = Router();

router.get("/notifications", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(notifications.map(n => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    imageUrl: n.imageUrl, isRead: n.isRead, createdAt: n.createdAt.toISOString(),
  })));
});

router.post("/notifications/read-all", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, userId));
  res.json({ message: "All notifications marked as read" });
});

export default router;
