import prisma from "../../lib/prisma.js";

import {
  toNumber,
  calculateProfit,
} from "./analyticsHelper.js";

export const branchAnalytics = async (companyId) => {
  const sales = await prisma.sale.findMany({
    where: {
      companyId,
      status: "COMPLETED",          // ← added
    },
    include: {
      saleItems: {
        include: {
          product: true,
        },
      },
      store: true,
    },
  });

  const branchMap = {};

  sales.forEach((sale) => {
    if (!branchMap[sale.storeId]) {
      branchMap[sale.storeId] = {
        storeId: sale.storeId,
        storeName: sale.store.name,
        revenue: 0,
        profit: 0,
        transactions: 0,
      };
    }

    branchMap[sale.storeId].revenue += toNumber(sale.totalAmount);
    branchMap[sale.storeId].profit += calculateProfit(sale.saleItems);
    branchMap[sale.storeId].transactions++;
  });

  Object.values(branchMap).forEach((branch) => {
    branch.averageSale =
      branch.transactions === 0 ? 0 : branch.revenue / branch.transactions;
  });

  // Customers
  const customers = await prisma.customer.groupBy({
    by: ["storeId"],
    where: { companyId },
    _count: true,
  });

  customers.forEach((customer) => {
    if (branchMap[customer.storeId]) {
      branchMap[customer.storeId].customers = customer._count;
    }
  });

  // Inventory value per branch
  const products = await prisma.product.findMany({
    where: { companyId },
  });

  products.forEach((product) => {
    if (!branchMap[product.storeId]) return;

    if (!branchMap[product.storeId].inventoryValue) {
      branchMap[product.storeId].inventoryValue = 0;
    }

    branchMap[product.storeId].inventoryValue +=
      toNumber(product.stockQuantity) * toNumber(product.buyingPrice);
  });

  const branchPerformance = Object.values(branchMap).sort(
    (a, b) => b.revenue - a.revenue
  );

  const bestBranch = branchPerformance[0] || null;
  const weakestBranch =
    branchPerformance.length > 0
      ? branchPerformance[branchPerformance.length - 1]
      : null;

  const totalRevenue = branchPerformance.reduce(
    (sum, branch) => sum + branch.revenue,
    0
  );

  branchPerformance.forEach((branch) => {
    branch.marketShare =
      totalRevenue === 0 ? 0 : (branch.revenue / totalRevenue) * 100;
  });

  return {
    branchPerformance,
    bestBranch,
    weakestBranch,
    totalRevenue,
    totalBranches: branchPerformance.length,
  };
};