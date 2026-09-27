import prisma from "../../lib/prisma.js";
import { createNotification } from "./notification.service.js";

export const generateLowStockNotifications = async (companyId) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { lowStockThreshold: true },
  });
  const threshold = company?.lowStockThreshold ?? 10;

  const products = await prisma.product.findMany({
    where: {
      companyId,
      stockQuantity: { lte: threshold },
      isActive: true,
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  for (const product of products) {
    await createNotification({
      companyId,
      storeId: product.storeId,
      title: "Low Stock Alert",
      message: `${product.name} is running low. Current stock: ${product.stockQuantity}`,
      type: "LOW_STOCK",
      priority: product.stockQuantity === 0 ? "CRITICAL" : "HIGH",
      uniqueKey: `LOW_STOCK_${product.id}_${today}`,
      metadata: {
        productId: product.id,
        productName: product.name,
        currentStock: product.stockQuantity,
        threshold,
      },
    });
  }
};