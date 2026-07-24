import { Router } from "express";
import { db } from "../lib/db/index.js";
import { groupsTable, groupMembersTable, usersTable, conversationsTable, messagesTable } from "../lib/db/index.js";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { formatUser } from "./auth.js";

const router = Router();

async function notifyViaMessage(fromUserId: number, toUserId: number, content: string, messageType: string) {
  if (fromUserId === toUserId) return;
  const [existing] = await db.select().from(conversationsTable)
    .where(sql`(${conversationsTable.user1Id} = ${fromUserId} AND ${conversationsTable.user2Id} = ${toUserId}) OR (${conversationsTable.user1Id} = ${toUserId} AND ${conversationsTable.user2Id} = ${fromUserId})`)
    .limit(1);
  const conv = existing ?? (await db.insert(conversationsTable).values({ user1Id: fromUserId, user2Id: toUserId }).returning())[0];
  if (!conv) return;
  await db.insert(messagesTable).values({ conversationId: conv.id, senderId: fromUserId, content, messageType });
  await db.update(conversationsTable).set({ lastMessage: content, lastMessageAt: new Date() }).where(eq(conversationsTable.id, conv.id));
}

async function formatGroup(group: typeof groupsTable.$inferSelect, userId?: number) {
  let isMember = false;
  if (userId) {
    const [mem] = await db.select().from(groupMembersTable)
      .where(sql`${groupMembersTable.groupId} = ${group.id} AND ${groupMembersTable.userId} = ${userId}`)
      .limit(1);
    isMember = !!mem;
  }
  return {
    id: group.id, name: group.name, description: group.description,
    logoUrl: group.logoUrl, coverUrl: group.coverUrl, type: group.type,
    membersCount: group.membersCount, category: group.category, city: group.city,
    createdById: group.createdById, isMember,
    createdAt: group.createdAt.toISOString(),
  };
}

router.get("/groups", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const filter = req.query.filter as string;
  let groups;
  if (filter === "mine") {
    const myMemberships = await db.select({ groupId: groupMembersTable.groupId }).from(groupMembersTable).where(eq(groupMembersTable.userId, userId));
    const myGroupIds = myMemberships.map(m => m.groupId);
    groups = myGroupIds.length > 0
      ? await db.select().from(groupsTable).where(sql`${groupsTable.id} = ANY(${myGroupIds}::int[])`).limit(20)
      : [];
  } else {
    groups = await db.select().from(groupsTable).orderBy(sql`${groupsTable.membersCount} DESC`).limit(20);
  }
  const result = await Promise.all(groups.map(g => formatGroup(g, userId)));
  res.json(result);
});

router.post("/groups", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const { name, description, type, category, city, logoUrl, coverUrl } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const [group] = await db.insert(groupsTable).values({
    name, description: description || null, type: type || "public",
    category: category || null, city: city || null,
    logoUrl: logoUrl || null, coverUrl: coverUrl || null, createdById: userId,
  }).returning();
  if (!group) { res.status(500).json({ error: "Failed to create group" }); return; }
  await db.insert(groupMembersTable).values({ groupId: group.id, userId, role: "admin" });
  res.status(201).json(await formatGroup(group, userId));
});

router.get("/groups/:groupId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const groupId = parseInt(req.params.groupId, 10);
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }
  res.json(await formatGroup(group, userId));
});

router.patch("/groups/:groupId", authMiddleware, async (req, res) => {
  const groupId = parseInt(req.params.groupId, 10);
  const { name, description, type, category, city, logoUrl, coverUrl } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (type !== undefined) updates.type = type;
  if (category !== undefined) updates.category = category;
  if (city !== undefined) updates.city = city;
  if (logoUrl !== undefined) updates.logoUrl = logoUrl;
  if (coverUrl !== undefined) updates.coverUrl = coverUrl;
  const [group] = await db.update(groupsTable).set(updates).where(eq(groupsTable.id, groupId)).returning();
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }
  res.json(await formatGroup(group));
});

router.get("/groups/:groupId/members", authMiddleware, async (req, res) => {
  const groupId = parseInt(req.params.groupId, 10);
  const members = await db
    .select({
      id: groupMembersTable.id, groupId: groupMembersTable.groupId,
      userId: groupMembersTable.userId, role: groupMembersTable.role,
      vehicleNickname: groupMembersTable.vehicleNickname, vehicleType: groupMembersTable.vehicleType,
      joinedAt: groupMembersTable.joinedAt,
      userName: usersTable.name, userUsername: usersTable.username,
      userAvatarUrl: usersTable.avatarUrl, userCity: usersTable.city,
      userVehicleType: usersTable.vehicleType,
    })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, groupId))
    .limit(100);
  res.json(members.map(m => ({
    id: m.id, groupId: m.groupId, userId: m.userId, role: m.role,
    vehicleNickname: m.vehicleNickname, vehicleType: m.vehicleType, joinedAt: m.joinedAt,
    user: { id: m.userId, name: m.userName, username: m.userUsername, avatarUrl: m.userAvatarUrl, city: m.userCity, vehicleType: m.userVehicleType },
  })));
});

router.post("/groups/:groupId/members", authMiddleware, async (req, res) => {
  const groupId = parseInt(req.params.groupId, 10);
  const { userId: targetUserId, role, vehicleNickname, vehicleType } = req.body;
  if (!targetUserId) { res.status(400).json({ error: "userId required" }); return; }
  await db.insert(groupMembersTable).values({ groupId, userId: targetUserId, role: role || "member", vehicleNickname: vehicleNickname || null, vehicleType: vehicleType || null }).onConflictDoNothing();
  await db.update(groupsTable).set({ membersCount: sql`${groupsTable.membersCount} + 1` }).where(eq(groupsTable.id, groupId));
  res.json({ message: "Member added" });
});

router.patch("/groups/:groupId/members/:memberId", authMiddleware, async (req, res) => {
  const groupId = parseInt(req.params.groupId, 10);
  const memberId = parseInt(req.params.memberId, 10);
  const { role, vehicleNickname, vehicleType } = req.body;
  const updates: Record<string, any> = {};
  if (role !== undefined) updates.role = role;
  if (vehicleNickname !== undefined) updates.vehicleNickname = vehicleNickname;
  if (vehicleType !== undefined) updates.vehicleType = vehicleType;
  await db.update(groupMembersTable).set(updates).where(sql`${groupMembersTable.groupId} = ${groupId} AND ${groupMembersTable.userId} = ${memberId}`);
  res.json({ message: "Member updated" });
});

router.delete("/groups/:groupId/members/:memberId", authMiddleware, async (req, res) => {
  const groupId = parseInt(req.params.groupId, 10);
  const memberId = parseInt(req.params.memberId, 10);
  const deleted = await db.delete(groupMembersTable).where(sql`${groupMembersTable.groupId} = ${groupId} AND ${groupMembersTable.userId} = ${memberId}`).returning();
  if (deleted.length > 0) {
    await db.update(groupsTable).set({ membersCount: sql`GREATEST(${groupsTable.membersCount} - 1, 0)` }).where(eq(groupsTable.id, groupId));
  }
  res.json({ message: "Member removed" });
});

router.post("/groups/:groupId/join", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const groupId = parseInt(req.params.groupId, 10);
  const [existing] = await db.select().from(groupMembersTable)
    .where(sql`${groupMembersTable.groupId} = ${groupId} AND ${groupMembersTable.userId} = ${userId}`)
    .limit(1);
  if (existing) { res.json({ message: "Already a member" }); return; }
  await db.insert(groupMembersTable).values({ groupId, userId }).onConflictDoNothing();
  await db.update(groupsTable).set({ membersCount: sql`${groupsTable.membersCount} + 1` }).where(eq(groupsTable.id, groupId));
  try {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    const [requester] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (group && requester) {
      const admins = await db.select().from(groupMembersTable)
        .where(sql`${groupMembersTable.groupId} = ${groupId} AND ${groupMembersTable.role} = 'admin' AND ${groupMembersTable.userId} != ${userId}`)
        .limit(10);
      const payload = JSON.stringify({ type: "group_join_request", groupId: group.id, groupName: group.name, groupLogoUrl: group.logoUrl, requesterId: requester.id, requesterName: requester.name, requesterAvatar: requester.avatarUrl });
      await Promise.all(admins.map(a => notifyViaMessage(userId, a.userId, payload, "group_join_request")));
    }
  } catch (_) { /* notification failure must not break the join */ }
  res.json({ message: "Joined group" });
});

router.post("/groups/:groupId/leave", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const groupId = parseInt(req.params.groupId, 10);
  const left = await db.delete(groupMembersTable).where(sql`${groupMembersTable.groupId} = ${groupId} AND ${groupMembersTable.userId} = ${userId}`).returning();
  if (left.length > 0) {
    await db.update(groupsTable).set({ membersCount: sql`GREATEST(${groupsTable.membersCount} - 1, 0)` }).where(eq(groupsTable.id, groupId));
  }
  res.json({ message: "Left group" });
});

export default router;
