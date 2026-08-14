// Run: node scripts/resetPlatformAdminPassword.js you@example.com NewPassword123
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

const run = async () => {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log("Usage: node scripts/resetPlatformAdminPassword.js <email> <newPassword>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const admin = await prisma.platformAdmin.update({
    where: { email },
    data: { passwordHash },
  });

  console.log(`Password reset for ${admin.email}`);
  process.exit(0);
};

run();
