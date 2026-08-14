import prisma from "../../lib/prisma.js";

import { createNotification } from "./notification.service.js";

export const generateLowStockNotifications = async (companyId) => {
  const products = await prisma.product.findMany({
    where: {
      companyId,

      stockQuantity: {
        lte: 5,
      },

      isActive: true,
    },
  });

  const today = new Date().toISOString().slice(0, 10); // e.g. "2026-08-07"

  for (const product of products) {
    await createNotification({
      companyId,

      storeId: product.storeId,

      title: "Low Stock Alert",

      message: `${product.name} is running low. Current stock: ${product.stockQuantity}`,

      type: "LOW_STOCK",

      priority: product.stockQuantity === 0 ? "CRITICAL" : "HIGH",

      // Date-scoped: this product can alert again on a NEW day once it's
      // still (or newly) low — but won't spam multiple times per day.
      // Once restocked above threshold, a future dip generates a fresh key.
      uniqueKey: `LOW_STOCK_${product.id}_${today}`,

      metadata: {
        productId: product.id,
        productName: product.name,
        currentStock: product.stockQuantity,
        threshold: 5,
      },
    });
  }
};
