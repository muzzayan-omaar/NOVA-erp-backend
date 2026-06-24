import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findFirst();

  if (!store) {
    console.log("No store found. Seed store first.");
    return;
  }

  await prisma.product.createMany({
    data: [
      {
        name: "Coca Cola 500ml",
        barcode: "100001",
        sku: "COKE500",
        buyingPrice: 1500,
        sellingPrice: 2000,
        stockQuantity: 100,
        storeId: store.id,
      },
      {
        name: "Pepsi 500ml",
        barcode: "100002",
        sku: "PEPSI500",
        buyingPrice: 1400,
        sellingPrice: 2000,
        stockQuantity: 80,
        storeId: store.id,
      },
      {
        name: "Sugar 1kg",
        barcode: "100003",
        sku: "SUGAR1KG",
        buyingPrice: 3200,
        sellingPrice: 4000,
        stockQuantity: 50,
        storeId: store.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log("Products seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());