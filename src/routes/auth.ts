import { Router } from "express";
import { db } from "../lib/db/index.js";
import { usersTable } from "../lib/db/index.js";
import { eq } from "drizzle-orm";
import { hashPassword, generateToken, authMiddleware } from "../lib/auth.js";
import { SignupBody, LoginBody } from "../lib/api-zod/index.js";

const router = Router();

// ── OTP store (in-memory; replace with Redis for multi-instance) ──────────────
interface OtpEntry { code: string; expires: number; userId: number; }
const otpStore = new Map<string, OtpEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore) {
    if (entry.expires < now) otpStore.delete(key);
  }
}, 10 * 60 * 1000);

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  const sgKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.FROM_EMAIL ?? "noreply@motohippi.com";

  if (sgKey) {
    try {
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sgKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: fromEmail, name: "MotoHippi" },
          subject: "Your MotoHippi verification code",
          content: [
            {
              type: "text/html",
              value: `
                <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f0f0f;color:#fff;border-radius:12px;overflow:hidden;">
                  <div style="background:#a3e635;padding:24px;text-align:center;">
                    <h1 style="color:#000;margin:0;font-size:28px;font-weight:900;">🏍️ MotoHippi</h1>
                  </div>
                  <div style="padding:32px;">
                    <h2 style="margin-top:0;">Verify your email</h2>
                    <p style="color:#aaa;">Use the code below. It expires in 10 minutes.</p>
                    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;text-align:center;padding:24px;margin:24px 0;">
                      <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#a3e635;">${code}</span>
                    </div>
                    <p style="color:#555;font-size:13px;">If you didn't request this, ignore this email.</p>
                  </div>
                </div>`,
            },
          ],
        }),
      });
      return;
    } catch (e) {
      console.error("SendGrid error:", e);
    }
  }
  // Fallback: console log for dev / when SendGrid is not configured
  console.log(`\n🔑 OTP for ${email}: ${code}\n`);
}

// ── User formatter (shared across routes) ────────────────────────────────────
export function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    city: user.city,
    country: user.country,
    age: user.age,
    gender: user.gender,
    vehicleType: user.vehicleType,
    adventureLevel: user.adventureLevel,
    travelStyle: user.travelStyle,
    lookingFor: (user.lookingFor as string[]) || [],
    interests: (user.interests as string[]) || [],
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    tripsCount: user.tripsCount,
    isVerified: user.isVerified,
    createdAt: user.createdAt
      ? new Date(user.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post("/auth/signup", async (req, res) => {
  const result = SignupBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid input", details: result.error.flatten() });
    return;
  }
  const { name, email, password, phone } = result.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash: hashPassword(password), phone: phone ?? null })
    .returning();
  if (!user) { res.status(500).json({ error: "Failed to create user" }); return; }

  const token = generateToken(user.id);
  const code = generateOtp();
  otpStore.set(email, { code, expires: Date.now() + 10 * 60 * 1000, userId: user.id });
  await sendOtpEmail(email, code).catch(() => {});

  res.status(201).json({ token, user: formatUser(user), emailVerificationSent: true });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const result = LoginBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = result.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = generateToken(user.id);
  res.status(200).json({ token, user: formatUser(user), requiresVerification: !user.isVerified });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
router.post("/auth/send-otp", authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.isVerified) { res.json({ message: "Already verified" }); return; }

  const existing = otpStore.get(user.email);
  if (existing && existing.expires - Date.now() > 9 * 60 * 1000) {
    res.json({ message: "OTP already sent recently" });
    return;
  }

  const code = generateOtp();
  otpStore.set(user.email, { code, expires: Date.now() + 10 * 60 * 1000, userId: user.id });
  await sendOtpEmail(user.email, code).catch(() => {});
  res.json({ message: "OTP sent" });
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
router.post("/auth/verify-otp", authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const entry = otpStore.get(user.email);
  if (!entry) { res.status(400).json({ error: "No OTP found. Please request a new code." }); return; }
  if (Date.now() > entry.expires) {
    otpStore.delete(user.email);
    res.status(400).json({ error: "OTP has expired. Please request a new code." });
    return;
  }
  if (entry.code !== code.trim()) {
    res.status(400).json({ error: "Invalid code. Please try again." });
    return;
  }

  await db.update(usersTable).set({ isVerified: true }).where(eq(usersTable.id, userId));
  otpStore.delete(user.email);

  const token = generateToken(userId);
  const updatedUser = { ...formatUser(user), isVerified: true };
  res.json({ message: "Email verified", token, user: updatedUser });
});

// ── GET /api/auth/google ──────────────────────────────────────────────────────
router.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const frontendUrl = process.env.FRONTEND_URL ?? "";
    res.redirect(`${frontendUrl}/login?error=google_not_configured`);
    return;
  }
  const appUrl = process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
router.get("/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const frontendUrl = process.env.FRONTEND_URL ?? "";

  if (error || !code || !clientId || !clientSecret) {
    res.redirect(`${frontendUrl}/login?error=google_failed`);
    return;
  }

  try {
    const appUrl = process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokens.access_token) throw new Error("No access token");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json() as any;
    const { email, name, picture } = profile;
    if (!email) throw new Error("No email from Google");

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      const [created] = await db.insert(usersTable).values({
        name: name || email.split("@")[0],
        email,
        passwordHash: hashPassword(crypto.randomUUID()),
        avatarUrl: picture || null,
        isVerified: true,
      }).returning();
      if (!created) throw new Error("Failed to create Google user");
      user = created;
    } else if (!user.isVerified) {
      await db.update(usersTable).set({ isVerified: true }).where(eq(usersTable.id, user.id));
      user = { ...user, isVerified: true };
    }

    const token = generateToken(user.id);
    res.redirect(`${frontendUrl}/login?token=${token}&verified=true`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${frontendUrl}/login?error=google_failed`);
  }
});

export default router;
