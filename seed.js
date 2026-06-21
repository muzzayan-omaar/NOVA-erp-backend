import prisma from "./src/lib/prisma.js";

async function seedProducts() {
  try {
    const products = [
      {
        name: "Claw Hammer",
        barcode: "HAM001",
        sku: "TOOL-HAM-01",
        buyingPrice: 8500,
        sellingPrice: 12500,
        stockQuantity: 42,
        unitType: "pcs"
      },
      {
        name: "Phillips Screwdriver Set",
        barcode: "SCR002",
        sku: "TOOL-SCR-02",
        buyingPrice: 6500,
        sellingPrice: 9800,
        stockQuantity: 35,
        unitType: "set"
      },
      {
        name: "1kg Box of Nails",
        barcode: "NAIL003",
        sku: "FAST-NAL-03",
        buyingPrice: 3200,
        sellingPrice: 4500,
        stockQuantity: 78,
        unitType: "box"
      },
      {
        name: "Paint Brush 4 inch",
        barcode: "PBR004",
        sku: "TOOL-PBR-04",
        buyingPrice: 2800,
        sellingPrice: 4200,
        stockQuantity: 64,
        unitType: "pcs"
      },
      {
        name: "Measuring Tape 5m",
        barcode: "TAPE005",
        sku: "TOOL-TAP-05",
        buyingPrice: 5200,
        sellingPrice: 7800,
        stockQuantity: 29,
        unitType: "pcs"
      },
      {
        name: "Electrical Wires 2.5mm (Roll)",
        barcode: "WIRE006",
        sku: "ELEC-WIR-06",
        buyingPrice: 18500,
        sellingPrice: 24500,
        stockQuantity: 18,
        unitType: "roll"
      },
      {
        name: "PVC Pipe 1 inch (3m)",
        barcode: "PIPE007",
        sku: "PLUM-PIP-07",
        buyingPrice: 6500,
        sellingPrice: 9200,
        stockQuantity: 55,
        unitType: "pcs"
      }
    ];

    for (const product of products) {
      await prisma.product.create({
        data: {
          ...product,
          storeId: "0cfd0eb0-ff1b-4aa6-a71d-8df5c9738b08" // Your store ID from registration
        }
      });
      console.log(`✅ Added: ${product.name}`);
    }

    console.log("\n🎉 Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    process.exit();
  }
}

seedProducts();