import { Router } from "express";
import { db } from "../lib/db/index.js";
import { usersTable, swipesTable, matchesTable, conversationsTable } from "../lib/db/index.js";
import { eq, ne, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { formatUser } from "./auth.js";
import { SwipeBody } from "../lib/api-zod/index.js";

const router = Router();

router.get("/discover/candidates", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const swiped = await db.select({ targetId: swipesTable.targetId }).from(swipesTable).where(eq(swipesTable.swiperId, userId));
  const swipedIds = swiped.map(s => s.targetId);

  const baseWhere = swipedIds.length > 0
    ? sql`${usersTable.id} != ${userId} AND ${usersTable.id} NOT IN (${sql.join(swipedIds.map(id => sql`${id}`), sql`, `)})`
    : ne(usersTable.id, userId);

  const candidates = await db.select().from(usersTable).where(baseWhere).limit(20);
  const result = candidates.map((user) => ({
    id: user.id,
    name: user.name,
    age: user.age ?? 25,
    city: user.city ?? "Mumbai",
    country: user.country,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    vehicleType: user.vehicleType ?? "motorcycle",
    vehicles: [],
    adventureLevel: user.adventureLevel ?? "intermediate",
    travelStyle: user.travelStyle,
    interests: (user.interests as string[]) || [],
    lookingFor: (user.lookingFor as string[]) || [],
    bio: user.bio,
    distanceKm: Math.floor(Math.random() * 200) + 5,
    isVerified: user.isVerified,
  }));
  res.json(result);
});

router.post("/discover/swipe", authMiddleware, async (req, res) => {
  const swiperId = (req as any).userId;
  const result = SwipeBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { targetUserId, action } = result.data;

  await db.insert(swipesTable).values({ swiperId, targetId: targetUserId, action }).onConflictDoNothing();

  let isMatch = false;
  let match = null;
  if (action === "like" || action === "superlike") {
    const [theirSwipe] = await db.select().from(swipesTable)
      .where(sql`${swipesTable.swiperId} = ${targetUserId} AND ${swipesTable.targetId} = ${swiperId} AND ${swipesTable.action} IN ('like', 'superlike')`)
      .limit(1);

    if (theirSwipe) {
      isMatch = true;
      const [conv] = await db.insert(conversationsTable).values({ user1Id: swiperId, user2Id: targetUserId }).returning();
      if (!conv) { res.status(500).json({ error: "Failed to create conversation" }); return; }
      const [newMatch] = await db.insert(matchesTable).values({ user1Id: swiperId, user2Id: targetUserId, conversationId: conv.id }).returning();
      if (!newMatch) { res.status(500).json({ error: "Failed to create match" }); return; }
      const [matchedUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
      if (!matchedUser) { res.status(404).json({ error: "Matched user not found" }); return; }
      match = {
        id: newMatch.id,
        user: formatUser(matchedUser),
        conversationId: conv.id,
        matchedAt: newMatch.matchedAt.toISOString(),
      };
    }
  }
  res.json({ isMatch, match });
});

router.get("/discover/matches", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const userMatches = await db.select().from(matchesTable)
    .where(sql`${matchesTable.user1Id} = ${userId} OR ${matchesTable.user2Id} = ${userId}`)
    .limit(50);

  const result = (await Promise.all(userMatches.map(async (m) => {
    const otherUserId = m.user1Id === userId ? m.user2Id : m.user1Id;
    const [otherUser] = await db.select().from(usersTable).where(eq(usersTable.id, otherUserId)).limit(1);
    if (!otherUser) return null;
    return {
      id: m.id,
      user: formatUser(otherUser),
      conversationId: m.conversationId,
      matchedAt: m.matchedAt.toISOString(),
    };
  }))).filter(Boolean);
  res.json(result);
});

export default router;
