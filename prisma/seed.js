import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.create({
    data: {
      name: "Nova Demo Company",
      email: "admin@novaerp.com",
      phone: "+256700000000",
      country: "Uganda",
      currency: "UGX",
      timezone: "Africa/Kampala",
    },
  });

  console.log("✅ Company created");

  const headOffice = await prisma.store.create({
    data: {
      companyId: company.id,
      name: "Head Office",
      location: "Kampala",
      isHeadOffice: true,
    },
  });

  const branch1 = await prisma.store.create({
    data: {
      companyId: company.id,
      name: "Branch 1",
      location: "Ntinda",
      isHeadOffice: false,
    },
  });

  console.log("✅ Stores created");

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      companyId: company.id,

      name: "System Owner",

      email: "admin@novaerp.com",

      passwordHash,

      role: Role.GENERAL_MANAGER,

      storeId: headOffice.id,

      activeStoreId: headOffice.id,
    },
  });

  console.log("✅ General Manager created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
