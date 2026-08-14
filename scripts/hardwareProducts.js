

import prisma from "../src/lib/prisma.js";

const hardwareProducts = [
  // ── Fasteners ──────────────────────────────────────────────
  { name: "Common Nail 2 inch (1kg)", sku: "HW-NL-001", buyingPrice: 4500, sellingPrice: 6500, stockQuantity: 120, unitType: "kg" },
  { name: "Common Nail 3 inch (1kg)", sku: "HW-NL-002", buyingPrice: 4800, sellingPrice: 7000, stockQuantity: 95, unitType: "kg" },
  { name: "Common Nail 4 inch (1kg)", sku: "HW-NL-003", buyingPrice: 5200, sellingPrice: 7500, stockQuantity: 80, unitType: "kg" },
  { name: "Roofing Nail 3 inch (1kg)", sku: "HW-NL-004", buyingPrice: 5500, sellingPrice: 8000, stockQuantity: 70, unitType: "kg" },
  { name: "Wood Screw 1.5 inch (box 100)", sku: "HW-SC-001", buyingPrice: 3200, sellingPrice: 4800, stockQuantity: 150, unitType: "box" },
  { name: "Wood Screw 2 inch (box 100)", sku: "HW-SC-002", buyingPrice: 3800, sellingPrice: 5500, stockQuantity: 130, unitType: "box" },
  { name: "Self-Tapping Screw 1 inch (box 100)", sku: "HW-SC-003", buyingPrice: 4100, sellingPrice: 6000, stockQuantity: 110, unitType: "box" },
  { name: "Machine Bolt M8 x 50mm (pair)", sku: "HW-BT-001", buyingPrice: 800, sellingPrice: 1500, stockQuantity: 200, unitType: "pcs" },
  { name: "Machine Bolt M10 x 60mm (pair)", sku: "HW-BT-002", buyingPrice: 1100, sellingPrice: 2000, stockQuantity: 180, unitType: "pcs" },
  { name: "Hex Nut M8 (pack 20)", sku: "HW-NT-001", buyingPrice: 1500, sellingPrice: 2500, stockQuantity: 90, unitType: "pack" },

  // ── Hand Tools ─────────────────────────────────────────────
  { name: "Claw Hammer 16oz", sku: "HW-TL-001", buyingPrice: 18000, sellingPrice: 28000, stockQuantity: 35, unitType: "pcs" },
  { name: "Ball Peen Hammer 12oz", sku: "HW-TL-002", buyingPrice: 16000, sellingPrice: 25000, stockQuantity: 28, unitType: "pcs" },
  { name: "Screwdriver Set (6pcs)", sku: "HW-TL-003", buyingPrice: 22000, sellingPrice: 35000, stockQuantity: 40, unitType: "set" },
  { name: "Phillips Screwdriver #2", sku: "HW-TL-004", buyingPrice: 4500, sellingPrice: 7500, stockQuantity: 60, unitType: "pcs" },
  { name: "Flat Screwdriver 6 inch", sku: "HW-TL-005", buyingPrice: 4200, sellingPrice: 7000, stockQuantity: 55, unitType: "pcs" },
  { name: "Adjustable Wrench 10 inch", sku: "HW-TL-006", buyingPrice: 15000, sellingPrice: 24000, stockQuantity: 32, unitType: "pcs" },
  { name: "Combination Pliers 8 inch", sku: "HW-TL-007", buyingPrice: 12000, sellingPrice: 19000, stockQuantity: 45, unitType: "pcs" },
  { name: "Needle Nose Pliers", sku: "HW-TL-008", buyingPrice: 11000, sellingPrice: 17500, stockQuantity: 38, unitType: "pcs" },
  { name: "Hack Saw Frame + Blade", sku: "HW-TL-009", buyingPrice: 14000, sellingPrice: 22000, stockQuantity: 30, unitType: "pcs" },
  { name: "Tape Measure 5m", sku: "HW-TL-010", buyingPrice: 8000, sellingPrice: 13000, stockQuantity: 50, unitType: "pcs" },

  // ── Electrical ─────────────────────────────────────────────
  { name: "Electrical Cable 1.5mm (100m roll)", sku: "HW-EL-001", buyingPrice: 85000, sellingPrice: 120000, stockQuantity: 25, unitType: "roll" },
  { name: "Electrical Cable 2.5mm (100m roll)", sku: "HW-EL-002", buyingPrice: 125000, sellingPrice: 175000, stockQuantity: 18, unitType: "roll" },
  { name: "Socket Outlet Single", sku: "HW-EL-003", buyingPrice: 6500, sellingPrice: 10000, stockQuantity: 80, unitType: "pcs" },
  { name: "Socket Outlet Double", sku: "HW-EL-004", buyingPrice: 9500, sellingPrice: 15000, stockQuantity: 65, unitType: "pcs" },
  { name: "Light Switch 1-Way", sku: "HW-EL-005", buyingPrice: 4500, sellingPrice: 7500, stockQuantity: 90, unitType: "pcs" },
  { name: "Light Switch 2-Way", sku: "HW-EL-006", buyingPrice: 5500, sellingPrice: 9000, stockQuantity: 70, unitType: "pcs" },
  { name: "Circuit Breaker 20A", sku: "HW-EL-007", buyingPrice: 18000, sellingPrice: 28000, stockQuantity: 40, unitType: "pcs" },
  { name: "Circuit Breaker 32A", sku: "HW-EL-008", buyingPrice: 22000, sellingPrice: 34000, stockQuantity: 35, unitType: "pcs" },
  { name: "LED Bulb 9W", sku: "HW-EL-009", buyingPrice: 3500, sellingPrice: 6000, stockQuantity: 150, unitType: "pcs" },
  { name: "LED Bulb 12W", sku: "HW-EL-010", buyingPrice: 4500, sellingPrice: 7500, stockQuantity: 120, unitType: "pcs" },

  // ── Plumbing ───────────────────────────────────────────────
  { name: "PVC Pipe ½ inch (3m)", sku: "HW-PL-001", buyingPrice: 4500, sellingPrice: 7000, stockQuantity: 100, unitType: "pcs" },
  { name: "PVC Pipe ¾ inch (3m)", sku: "HW-PL-002", buyingPrice: 6500, sellingPrice: 10000, stockQuantity: 85, unitType: "pcs" },
  { name: "PVC Pipe 1 inch (3m)", sku: "HW-PL-003", buyingPrice: 9500, sellingPrice: 14500, stockQuantity: 70, unitType: "pcs" },
  { name: "PVC Elbow ½ inch", sku: "HW-PL-004", buyingPrice: 800, sellingPrice: 1500, stockQuantity: 200, unitType: "pcs" },
  { name: "PVC Tee ½ inch", sku: "HW-PL-005", buyingPrice: 1200, sellingPrice: 2000, stockQuantity: 180, unitType: "pcs" },
  { name: "Ball Valve ½ inch", sku: "HW-PL-006", buyingPrice: 8500, sellingPrice: 13500, stockQuantity: 55, unitType: "pcs" },
  { name: "Ball Valve ¾ inch", sku: "HW-PL-007", buyingPrice: 11000, sellingPrice: 17000, stockQuantity: 45, unitType: "pcs" },
  { name: "Teflon Tape (roll)", sku: "HW-PL-008", buyingPrice: 1500, sellingPrice: 2500, stockQuantity: 120, unitType: "pcs" },
  { name: "Pipe Wrench 14 inch", sku: "HW-PL-009", buyingPrice: 28000, sellingPrice: 42000, stockQuantity: 20, unitType: "pcs" },
  { name: "Flexible Hose ½ inch x 50cm", sku: "HW-PL-010", buyingPrice: 6500, sellingPrice: 10000, stockQuantity: 60, unitType: "pcs" },

  // ── Paint & Finishing ──────────────────────────────────────
  { name: "Emulsion Paint White 4L", sku: "HW-PT-001", buyingPrice: 32000, sellingPrice: 48000, stockQuantity: 40, unitType: "tin" },
  { name: "Emulsion Paint White 20L", sku: "HW-PT-002", buyingPrice: 135000, sellingPrice: 195000, stockQuantity: 15, unitType: "tin" },
  { name: "Gloss Paint Black 4L", sku: "HW-PT-003", buyingPrice: 38000, sellingPrice: 55000, stockQuantity: 25, unitType: "tin" },
  { name: "Paint Brush 2 inch", sku: "HW-PT-004", buyingPrice: 3500, sellingPrice: 6000, stockQuantity: 80, unitType: "pcs" },
  { name: "Paint Brush 4 inch", sku: "HW-PT-005", buyingPrice: 5500, sellingPrice: 9000, stockQuantity: 65, unitType: "pcs" },
  { name: "Paint Roller Set", sku: "HW-PT-006", buyingPrice: 12000, sellingPrice: 19000, stockQuantity: 35, unitType: "set" },
  { name: "Sandpaper Assorted (pack 10)", sku: "HW-PT-007", buyingPrice: 4500, sellingPrice: 7500, stockQuantity: 70, unitType: "pack" },
  { name: "Wood Varnish Clear 1L", sku: "HW-PT-008", buyingPrice: 18000, sellingPrice: 28000, stockQuantity: 30, unitType: "tin" },

  // ── Building / Safety ──────────────────────────────────────
  { name: "Cement 50kg (Ordinary Portland)", sku: "HW-BD-001", buyingPrice: 32000, sellingPrice: 38000, stockQuantity: 200, unitType: "bag" },
  { name: "Binding Wire 1kg", sku: "HW-BD-002", buyingPrice: 5500, sellingPrice: 8000, stockQuantity: 90, unitType: "kg" },
  { name: "Wheelbarrow Heavy Duty", sku: "HW-BD-003", buyingPrice: 185000, sellingPrice: 260000, stockQuantity: 12, unitType: "pcs" },
  { name: "Shovel Round Point", sku: "HW-BD-004", buyingPrice: 28000, sellingPrice: 42000, stockQuantity: 25, unitType: "pcs" },
  { name: "Pick Axe", sku: "HW-BD-005", buyingPrice: 35000, sellingPrice: 52000, stockQuantity: 18, unitType: "pcs" },
  { name: "Spirit Level 60cm", sku: "HW-BD-006", buyingPrice: 22000, sellingPrice: 35000, stockQuantity: 22, unitType: "pcs" },
  { name: "Safety Helmet", sku: "HW-SF-001", buyingPrice: 15000, sellingPrice: 24000, stockQuantity: 40, unitType: "pcs" },
  { name: "Work Gloves (pair)", sku: "HW-SF-002", buyingPrice: 4500, sellingPrice: 8000, stockQuantity: 100, unitType: "pair" },
  { name: "Safety Goggles", sku: "HW-SF-003", buyingPrice: 8000, sellingPrice: 14000, stockQuantity: 55, unitType: "pcs" },
  { name: "Padlock 50mm", sku: "HW-SF-004", buyingPrice: 9500, sellingPrice: 15000, stockQuantity: 60, unitType: "pcs" },
];

/**
 * Seeds the 50 hardware products into EVERY existing company.
 * Uses the Head Office store when available, otherwise the first store.
 */
export async function seedHardwareProductsForAllCompanies() {
  const companies = await prisma.company.findMany({
    include: {
      stores: {
        orderBy: { isHeadOffice: "desc" }, // head office first
      },
    },
  });

  let totalCreated = 0;

  for (const company of companies) {
    if (company.stores.length === 0) {
      console.log(`⚠ Skipping company "${company.name}" — no stores`);
      continue;
    }

    const store = company.stores[0]; // head office (or first store)

    const result = await prisma.product.createMany({
      data: hardwareProducts.map((p) => ({
        companyId: company.id,
        storeId: store.id,
        name: p.name,
        sku: p.sku,
        buyingPrice: p.buyingPrice,
        sellingPrice: p.sellingPrice,
        stockQuantity: p.stockQuantity,
        unitType: p.unitType,
        isActive: true,
      })),
      skipDuplicates: true, // safe to re-run
    });

    totalCreated += result.count;
    console.log(`✓ ${company.name} → ${result.count} products added to "${store.name}"`);
  }

  console.log(`\nDone. Total products created: ${totalCreated}`);
  return totalCreated;
}