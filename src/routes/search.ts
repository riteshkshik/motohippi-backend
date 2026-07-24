import { Router } from "express";
import { db } from "../lib/db/index.js";
import { usersTable } from "../lib/db/index.js";
import { ne, eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { formatUser } from "./auth.js";

const router = Router();

router.get("/search/riders", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const {
    vehicleType, travelStyle, lookingFor,
    gender, experienceLevel, verifiedOnly,
    ageMin, ageMax,
  } = req.query as Record<string, string>;

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  let candidates = await db.select().from(usersTable).where(ne(usersTable.id, userId)).limit(50);

  if (vehicleType && vehicleType !== "any") {
    candidates = candidates.filter(u =>
      u.vehicleType?.toLowerCase().includes(vehicleType.toLowerCase()) ||
      vehicleType.toLowerCase().includes(u.vehicleType?.toLowerCase() || "")
    );
  }
  if (gender && gender !== "no_preference") {
    candidates = candidates.filter(u => u.gender?.toLowerCase() === gender.toLowerCase());
  }
  if (experienceLevel && experienceLevel !== "any") {
    candidates = candidates.filter(u => u.adventureLevel?.toLowerCase() === experienceLevel.toLowerCase());
  }
  if (verifiedOnly === "true") {
    candidates = candidates.filter(u => u.isVerified);
  }
  const ageMinN = ageMin ? parseInt(ageMin, 10) : NaN;
  const ageMaxN = ageMax ? parseInt(ageMax, 10) : NaN;
  if (!isNaN(ageMinN)) candidates = candidates.filter(u => !u.age || u.age >= ageMinN);
  if (!isNaN(ageMaxN)) candidates = candidates.filter(u => !u.age || u.age <= ageMaxN);

  const scored = candidates.map(u => {
    let score = 50;
    if (me?.vehicleType && u.vehicleType && me.vehicleType === u.vehicleType) score += 18;
    if (travelStyle && travelStyle !== "no_preference" &&
      (u.travelStyle?.toLowerCase().includes(travelStyle.toLowerCase()) ||
       (u.interests as string[] || []).some(i => i.toLowerCase().includes(travelStyle.toLowerCase())))) score += 15;
    if (lookingFor && lookingFor !== "any" &&
      (u.lookingFor as string[] || []).some(l => l.toLowerCase().includes(lookingFor.toLowerCase()))) score += 12;
    if (me?.city && u.city && me.city === u.city) score += 8;
    if (u.isVerified) score += 5;
    if (me?.adventureLevel && u.adventureLevel && me.adventureLevel === u.adventureLevel) score += 7;
    const jitter = (parseInt(u.id.toString()) % 10) - 3;
    score = Math.min(99, Math.max(52, score + jitter));
    const distanceKm = 5 + (parseInt(u.id.toString()) % 195);
    const rating = 3.5 + ((parseInt(u.id.toString()) % 15) / 10);
    return {
      ...formatUser(u),
      compatibilityScore: score,
      distanceKm,
      rating: parseFloat(rating.toFixed(1)),
      tripsCount: u.tripsCount ?? 0,
      travelStyle: u.travelStyle,
      lookingFor: (u.lookingFor as string[]) || [],
      interests: (u.interests as string[]) || [],
      mutualGroups: Math.floor(parseInt(u.id.toString()) % 4),
    };
  });

  scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  res.json(scored.slice(0, 20));
});

export default router;
