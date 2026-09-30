import prisma from "../src/lib/prisma.js";
import { generateUniqueStoreCode } from "../src/utils/generateStoreCode.js";

const run = async () => {
  const stores = await prisma.store.findMany({ where: { storeCode: null } });

  for (const s of stores) {
    const code = await generateUniqueStoreCode(prisma, s.name);
    await prisma.store.update({ where: { id: s.id }, data: { storeCode: code } });
    console.log(`${s.name} -> ${code}`);
  }

  console.log(`Backfilled ${stores.length} stores`);
  process.exit(0);
};

run();