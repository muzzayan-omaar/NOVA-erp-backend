// Run once, manually, from the backend root: node scripts/seedPlatformAdmin.js
// Never expose this as an API endpoint — platform admin accounts are
// deliberately not self-service.

import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";
import readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const run = async () => {
  const name = (await ask("Your name: ")).trim();
  const email = (await ask("Your email: ")).trim();
  const password = (await ask("Password: ")).trim();

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log("A platform admin with that email already exists.");
    rl.close();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.platformAdmin.create({
    data: { name, email, passwordHash },
  });

  console.log(`Created platform admin: ${admin.email}`);
  rl.close();
  process.exit(0);
};

run();
