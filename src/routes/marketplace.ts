import { Router } from "express";
import { db } from "../lib/db/index.js";
import { productsTable, cartItemsTable, wishlistItemsTable, ordersTable } from "../lib/db/index.js";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { AddToCartBody } from "../lib/api-zod/index.js";

const router = Router();

function formatProduct(p: typeof productsTable.$inferSelect, isWishlisted = false) {
  return {
    id: p.id, name: p.name, description: p.description,
    price: parseFloat(p.price), originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : null,
    category: p.category, brand: p.brand, imageUrl: p.imageUrl,
    images: (p.images as string[]) || [], rating: p.rating ? parseFloat(p.rating) : null,
    reviewsCount: p.reviewsCount, inStock: p.inStock, isWishlisted,
  };
}

async function buildCart(userId: number) {
  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  const itemsRaw = await Promise.all(cartItems.map(async item => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
    if (!product) return null;
    return { product: formatProduct(product), quantity: item.quantity };
  }));
  const items = itemsRaw.filter(Boolean) as { product: ReturnType<typeof formatProduct>; quantity: number }[];
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  return { items, total };
}

router.get("/products", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const { category, q } = req.query;
  let products = await db.select().from(productsTable).limit(40);
  if (category) products = products.filter(p => p.category === category);
  if (q) products = products.filter(p => p.name.toLowerCase().includes((q as string).toLowerCase()));
  const wishlist = await db.select({ productId: wishlistItemsTable.productId }).from(wishlistItemsTable).where(eq(wishlistItemsTable.userId, userId));
  const wishlistIds = new Set(wishlist.map(w => w.productId));
  res.json(products.map(p => formatProduct(p, wishlistIds.has(p.id))));
});

router.get("/products/featured", authMiddleware, async (req, res) => {
  const products = await db.select().from(productsTable).orderBy(sql`${productsTable.rating} DESC NULLS LAST`).limit(8);
  res.json(products.map(p => formatProduct(p)));
});

router.get("/products/:productId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const productId = parseInt(req.params.productId, 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  const [wishlistItem] = await db.select().from(wishlistItemsTable)
    .where(sql`${wishlistItemsTable.userId} = ${userId} AND ${wishlistItemsTable.productId} = ${productId}`)
    .limit(1);
  res.json(formatProduct(product, !!wishlistItem));
});

router.get("/cart", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  res.json(await buildCart(userId));
});

router.post("/cart", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const result = AddToCartBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { productId, quantity } = result.data;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  await db.insert(cartItemsTable).values({ userId, productId, quantity }).onConflictDoNothing();
  res.json(await buildCart(userId));
});

router.patch("/cart/:productId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const productId = parseInt(req.params.productId, 10);
  const quantity = parseInt(req.body.quantity, 10);
  if (isNaN(quantity) || quantity < 1) { res.status(400).json({ error: "Invalid quantity" }); return; }
  await db.update(cartItemsTable).set({ quantity }).where(sql`${cartItemsTable.userId} = ${userId} AND ${cartItemsTable.productId} = ${productId}`);
  res.json(await buildCart(userId));
});

router.delete("/cart/:productId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const productId = parseInt(req.params.productId, 10);
  await db.delete(cartItemsTable).where(sql`${cartItemsTable.userId} = ${userId} AND ${cartItemsTable.productId} = ${productId}`);
  res.json(await buildCart(userId));
});

router.get("/orders", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, userId)).orderBy(sql`${ordersTable.createdAt} DESC`);
  const formatted = await Promise.all(orders.map(async order => {
    const itemsData = (order.items as Array<{ productId: number; quantity: number; price: number }>) || [];
    const items = await Promise.all(itemsData.map(async item => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
      return { product: product ? formatProduct(product) : null, quantity: item.quantity };
    }));
    return { id: order.id, status: order.status, items: items.filter(i => i.product), total: parseFloat(order.total), createdAt: order.createdAt.toISOString() };
  }));
  res.json(formatted);
});

router.get("/wishlist", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const wishlistItems = await db.select().from(wishlistItemsTable).where(eq(wishlistItemsTable.userId, userId));
  const products = await Promise.all(wishlistItems.map(async item => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
    return product ? formatProduct(product, true) : null;
  }));
  res.json(products.filter(Boolean));
});

router.post("/wishlist/:productId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const productId = parseInt(req.params.productId, 10);
  await db.insert(wishlistItemsTable).values({ userId, productId }).onConflictDoNothing();
  res.json({ message: "Added to wishlist" });
});

router.delete("/wishlist/:productId", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const productId = parseInt(req.params.productId, 10);
  await db.delete(wishlistItemsTable).where(sql`${wishlistItemsTable.userId} = ${userId} AND ${wishlistItemsTable.productId} = ${productId}`);
  res.json({ message: "Removed from wishlist" });
});

export default router;
