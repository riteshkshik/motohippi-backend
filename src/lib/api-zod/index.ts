/**
 * Inlined Zod validation schemas — originally generated from the OpenAPI spec.
 * These replace the @workspace/api-zod workspace package.
 */
import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────────────────

export const HealthCheckResponse = z.object({ status: z.string() });

export const SignupBody = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().nullish(),
});

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const LogoutResponse = z.object({ message: z.string() });

// ── Users ─────────────────────────────────────────────────────────────────────

export const UpdateMyProfileBody = z.object({
  name: z.string().optional(),
  username: z.string().optional(),
  bio: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  vehicleType: z.string().optional(),
  adventureLevel: z.string().optional(),
  travelStyle: z.string().optional(),
  lookingFor: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
});

// ── Discover ──────────────────────────────────────────────────────────────────

export const SwipeBody = z.object({
  targetUserId: z.number(),
  action: z.enum(["like", "dislike", "superlike"]),
});

// ── Groups ────────────────────────────────────────────────────────────────────

export const CreateGroupBody = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(["public", "private"]).optional(),
  category: z.string().optional(),
  city: z.string().optional(),
});

export const UpdateGroupBody = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["public", "private"]).optional(),
});

// ── Feed ──────────────────────────────────────────────────────────────────────

export const CreatePostBody = z.object({
  content: z.string(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  location: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
});

export const CreateCommentBody = z.object({
  content: z.string(),
});

// ── Marketplace ───────────────────────────────────────────────────────────────

export const AddToCartBody = z.object({
  productId: z.number(),
  quantity: z.number().int().min(1).default(1),
});

// ── Messages ──────────────────────────────────────────────────────────────────

export const SendMessageBody = z.object({
  content: z.string(),
  messageType: z.string().optional(),
});

// ── Insurance ─────────────────────────────────────────────────────────────────

export const PurchaseInsuranceBody = z.object({
  planId: z.number(),
});

// ── Trips ─────────────────────────────────────────────────────────────────────

export const CreateTripBody = z.object({
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  stops: z.array(z.string()).optional(),
  visibility: z.enum(["public", "private", "friends"]).optional(),
  budget: z.number().optional(),
});

export const UpdateTripBody = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  destination: z.string().optional(),
  status: z.enum(["planning", "active", "completed", "cancelled"]).optional(),
});
