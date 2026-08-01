import { db, usersTable } from "./lib/db/index.js";
import { hashPassword } from "./lib/auth.js";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  const testEmail = "rider@motohippi.com";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, testEmail)).limit(1);

  if (existing.length === 0) {
    const salt = process.env.AUTH_SALT || "motohippi_change_this_to_a_long_random_secret_string";
    const passHash = hashPassword("password123");

    const [user] = await db.insert(usersTable).values({
      name: "Alex Rider",
      email: testEmail,
      passwordHash: passHash,
      username: "alex_rider",
      city: "San Francisco",
      country: "USA",
      vehicleType: "BMW R1250GS",
      adventureLevel: "Advanced",
      travelStyle: "Solo & Group",
      isVerified: true,
      bio: "Motorcycle enthusiast and cross-country explorer 🏍️",
    }).returning();

    console.log("✅ Created demo user:");
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: password123`);
  } else {
    console.log("ℹ️ Demo user already exists.");
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
