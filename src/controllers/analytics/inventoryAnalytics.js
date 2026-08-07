import prisma from "../../lib/prisma.js";

import { toNumber } from "./analyticsHelper.js";

export const inventoryAnalytics = async (companyId, storeId) => {
  const where = {
    companyId,
  };

  if (storeId !== "ALL") {
    where.storeId = storeId;
  }

  // Movements
  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: {
      product: true,
    },
  });

  // Products
  const products = await prisma.product.findMany({
    where,
  });

  let stockIn = 0;
  let stockOut = 0;
  let adjustments = 0;

  movements.forEach((movement) => {
    switch (movement.type) {
      case "IN":
        stockIn += toNumber(movement.quantity);
        break;
      case "OUT":
      case "SALE":
        stockOut += toNumber(movement.quantity);
        break;
      case "ADJUSTMENT":
        adjustments += toNumber(movement.quantity);
        break;
    }
  });

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + toNumber(product.buyingPrice) * toNumber(product.stockQuantity),
    0
  );

  const lowStock = products.filter(
    (product) => toNumber(product.stockQuantity) <= 10
  );

  const overStock = products.filter(
    (product) => toNumber(product.stockQuantity) >= 100
  );

  // Sales – only completed ones
  const sales = await prisma.sale.findMany({
    where: {
      ...where,
      status: "COMPLETED",           // ← added
    },
    include: {
      saleItems: {
        include: {
          product: true,
        },
      },
    },
  });

  const soldMap = {};

  sales.forEach((sale) => {
    sale.saleItems.forEach((item) => {
      if (!soldMap[item.productId]) {
        soldMap[item.productId] = {
          name: item.product.name,
          sold: 0,
          revenue: 0,
        };
      }

      soldMap[item.productId].sold += item.quantity;
      soldMap[item.productId].revenue += toNumber(item.subtotal);
    });
  });

  const fastMovingProducts = Object.values(soldMap)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 10);

  const soldIds = Object.keys(soldMap);

  const deadStock = products.filter(
    (product) =>
      !soldIds.includes(product.id) && toNumber(product.stockQuantity) > 0
  );

  const totalSold = Object.values(soldMap).reduce(
    (sum, item) => sum + item.sold,
    0
  );

  const totalStock = products.reduce(
    (sum, product) => sum + toNumber(product.stockQuantity),
    0
  );

  const inventoryTurnover = totalStock === 0 ? 0 : totalSold / totalStock;

  return {
    stockIn,
    stockOut,
    adjustments,
    inventoryValue,
    inventoryTurnover,
    lowStock,
    overStock,
    fastMovingProducts,
    deadStock,
  };
};