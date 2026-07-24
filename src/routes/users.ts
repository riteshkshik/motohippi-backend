import { Router } from "express";
import { db } from "../lib/db/index.js";
import { usersTable, followsTable } from "../lib/db/index.js";
import { eq, sql, ilike, or } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { formatUser } from "./auth.js";
import { UpdateMyProfileBody } from "../lib/api-zod/index.js";

const router = Router();

router.get("/users/me", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/me", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const result = UpdateMyProfileBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [user] = await db.update(usersTable).set(result.data).where(eq(usersTable.id, userId)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.get("/users/search", authMiddleware, async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q || q.length < 2) { res.json([]); return; }
  const users = await db
    .select()
    .from(usersTable)
    .where(or(
      ilike(usersTable.name, `%${q}%`),
      ilike(usersTable.username, `%${q}%`),
      ilike(usersTable.city, `%${q}%`),
    ))
    .limit(15);
  res.json(users.map(formatUser));
});

router.get("/users/:userId", authMiddleware, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.post("/users/:userId/follow", authMiddleware, async (req, res) => {
  const followerId = (req as any).userId;
  const followingId = parseInt(req.params.userId, 10);
  if (followerId === followingId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }
  const [existing] = await db.select().from(followsTable)
    .where(sql`${followsTable.followerId} = ${followerId} AND ${followsTable.followingId} = ${followingId}`)
    .limit(1);
  if (!existing) {
    await db.insert(followsTable).values({ followerId, followingId }).onConflictDoNothing();
    await db.update(usersTable).set({ followingCount: sql`${usersTable.followingCount} + 1` }).where(eq(usersTable.id, followerId));
    await db.update(usersTable).set({ followersCount: sql`${usersTable.followersCount} + 1` }).where(eq(usersTable.id, followingId));
  }
  res.json({ message: "Followed" });
});

router.post("/users/:userId/unfollow", authMiddleware, async (req, res) => {
  const followerId = (req as any).userId;
  const followingId = parseInt(req.params.userId, 10);
  const [existing] = await db.select().from(followsTable)
    .where(sql`${followsTable.followerId} = ${followerId} AND ${followsTable.followingId} = ${followingId}`)
    .limit(1);
  if (existing) {
    await db.delete(followsTable).where(
      sql`${followsTable.followerId} = ${followerId} AND ${followsTable.followingId} = ${followingId}`
    );
    await db.update(usersTable).set({ followingCount: sql`GREATEST(${usersTable.followingCount} - 1, 0)` }).where(eq(usersTable.id, followerId));
    await db.update(usersTable).set({ followersCount: sql`GREATEST(${usersTable.followersCount} - 1, 0)` }).where(eq(usersTable.id, followingId));
  }
  res.json({ message: "Unfollowed" });
});

export default router;
