import prisma from "../src/lib/prisma.js";
import { generateUniqueBusinessCode } from "../src/utils/generateBusinessCode.js";

const run = async () => {
  const companies = await prisma.company.findMany({ where: { businessCode: null } });

  for (const c of companies) {
    const code = await generateUniqueBusinessCode(prisma, c.name);
    await prisma.company.update({ where: { id: c.id }, data: { businessCode: code } });
    console.log(`${c.name} -> ${code}`);
  }

  console.log(`Backfilled ${companies.length} companies`);
  process.exit(0);
};

run();