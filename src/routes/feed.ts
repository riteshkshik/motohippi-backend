import { Router } from "express";
import { db } from "../lib/db/index.js";
import { postsTable, postLikesTable, commentsTable, usersTable } from "../lib/db/index.js";
import { eq, sql, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { formatUser } from "./auth.js";
import { CreatePostBody, CreateCommentBody } from "../lib/api-zod/index.js";

const router = Router();

async function formatPost(post: typeof postsTable.$inferSelect, userId?: number) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, post.authorId)).limit(1);
  if (!author) return null;
  let isLiked = false;
  if (userId) {
    const [like] = await db.select().from(postLikesTable)
      .where(sql`${postLikesTable.postId} = ${post.id} AND ${postLikesTable.userId} = ${userId}`)
      .limit(1);
    isLiked = !!like;
  }
  return {
    id: post.id, content: post.content, imageUrl: post.imageUrl, videoUrl: post.videoUrl,
    author: formatUser(author), likesCount: post.likesCount, commentsCount: post.commentsCount,
    isLiked, hashtags: (post.hashtags as string[]) || [], location: post.location,
    createdAt: post.createdAt.toISOString(),
  };
}

router.get("/feed", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const limit = parseInt(req.query.limit as string || "20", 10);
  const posts = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt)).limit(limit);
  const formatted = (await Promise.all(posts.map(p => formatPost(p, userId)))).filter(Boolean);
  res.json({ posts: formatted, nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : null });
});

router.get("/feed/trending", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const posts = await db.select().from(postsTable).orderBy(desc(postsTable.likesCount)).limit(10);
  const formatted = (await Promise.all(posts.map(p => formatPost(p, userId)))).filter(Boolean);
  res.json(formatted);
});

router.post("/posts", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const result = CreatePostBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [post] = await db.insert(postsTable).values({ ...result.data, authorId: userId }).returning();
  if (!post) { res.status(500).json({ error: "Failed to create post" }); return; }
  res.status(201).json(await formatPost(post, userId));
});

router.get("/posts/:postId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const postId = parseInt(req.params.postId, 10);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(await formatPost(post, userId));
});

router.patch("/posts/:postId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const postId = parseInt(req.params.postId, 10);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.authorId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { content, imageUrl, location, hashtags } = req.body;
  const updates: Partial<typeof postsTable.$inferInsert> = {};
  if (content !== undefined) updates.content = content;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (location !== undefined) updates.location = location;
  if (hashtags !== undefined) updates.hashtags = hashtags;
  const [updated] = await db.update(postsTable).set(updates).where(eq(postsTable.id, postId)).returning();
  if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(await formatPost(updated, userId));
});

router.delete("/posts/:postId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const postId = parseInt(req.params.postId, 10);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.authorId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ message: "Post deleted" });
});

router.post("/posts/:postId/like", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const postId = parseInt(req.params.postId, 10);
  const [existing] = await db.select().from(postLikesTable)
    .where(sql`${postLikesTable.postId} = ${postId} AND ${postLikesTable.userId} = ${userId}`)
    .limit(1);
  if (existing) {
    await db.delete(postLikesTable).where(sql`${postLikesTable.postId} = ${postId} AND ${postLikesTable.userId} = ${userId}`);
    await db.update(postsTable).set({ likesCount: sql`${postsTable.likesCount} - 1` }).where(eq(postsTable.id, postId));
    res.json({ message: "Unliked" });
  } else {
    await db.insert(postLikesTable).values({ postId, userId });
    await db.update(postsTable).set({ likesCount: sql`${postsTable.likesCount} + 1` }).where(eq(postsTable.id, postId));
    res.json({ message: "Liked" });
  }
});

router.get("/posts/:postId/comments", authMiddleware, async (req, res) => {
  const postId = parseInt(req.params.postId, 10);
  const comments = await db.select().from(commentsTable).where(eq(commentsTable.postId, postId)).orderBy(desc(commentsTable.createdAt));
  const formatted = (await Promise.all(comments.map(async c => {
    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, c.authorId)).limit(1);
    if (!author) return null;
    return { id: c.id, content: c.content, author: formatUser(author), createdAt: c.createdAt.toISOString() };
  }))).filter(Boolean);
  res.json(formatted);
});

router.post("/posts/:postId/comments", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const postId = parseInt(req.params.postId, 10);
  const result = CreateCommentBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [comment] = await db.insert(commentsTable).values({ postId, authorId: userId, ...result.data }).returning();
  if (!comment) { res.status(500).json({ error: "Failed to create comment" }); return; }
  await db.update(postsTable).set({ commentsCount: sql`${postsTable.commentsCount} + 1` }).where(eq(postsTable.id, postId));
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!author) { res.status(500).json({ error: "Author not found" }); return; }
  res.status(201).json({ id: comment.id, content: comment.content, author: formatUser(author), createdAt: comment.createdAt.toISOString() });
});

export default router;
