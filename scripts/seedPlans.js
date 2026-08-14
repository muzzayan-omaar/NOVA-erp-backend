// Run once: node scripts/seedPlans.js
import prisma from "../src/lib/prisma.js";

const PLANS = [
  { code: "BASIC", name: "Basic", price: 50000, durationDays: 30, sortOrder: 1 },
  { code: "STANDARD", name: "Standard", price: 100000, durationDays: 30, sortOrder: 2 },
  { code: "PREMIUM", name: "Premium", price: 180000, durationDays: 30, sortOrder: 3 },
];

const run = async () => {
  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  console.log("Plans seeded");
  process.exit(0);
};

run();
