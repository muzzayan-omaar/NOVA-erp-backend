import prisma from "../../lib/prisma.js";

import {
  toNumber,
  calculateProfit,
  getDaysAgo,
} from "./analyticsHelper.js";

export const financeAnalytics = async (
  companyId,
  storeId,
  period = 30
) => {
  const where = {
    companyId,
    status: "COMPLETED",           // ← added
    createdAt: {
      gte: getDaysAgo(period),
    },
  };

  if (storeId !== "ALL") {
    where.storeId = storeId;
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      saleItems: {
        include: {
          product: true,
        },
      },
    },
  });

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + toNumber(sale.totalAmount),
    0
  );

  const grossProfit = sales.reduce(
    (sum, sale) => sum + calculateProfit(sale.saleItems),
    0
  );

  const profitMargin =
    totalRevenue === 0 ? 0 : (grossProfit / totalRevenue) * 100;

  const vatCollected = sales.reduce(
    (sum, sale) => sum + toNumber(sale.vatAmount),
    0
  );

  const discounts = sales.reduce(
    (sum, sale) => sum + toNumber(sale.discount),
    0
  );

  // Payment methods
  const paymentMap = {};
  sales.forEach((sale) => {
    if (!paymentMap[sale.paymentMethod]) {
      paymentMap[sale.paymentMethod] = {
        method: sale.paymentMethod,
        amount: 0,
        transactions: 0,
      };
    }

    paymentMap[sale.paymentMethod].amount += toNumber(sale.totalAmount);
    paymentMap[sale.paymentMethod].transactions++;
  });

  const paymentMethods = Object.values(paymentMap);

  // Customer credit
  const customerWhere = { companyId };
  if (storeId !== "ALL") {
    customerWhere.storeId = storeId;
  }

  const customers = await prisma.customer.findMany({
    where: customerWhere,
    select: { totalCredit: true },
  });

  const customerCredit = customers.reduce(
    (sum, customer) => sum + toNumber(customer.totalCredit),
    0
  );

  // Supplier debt
  const supplierWhere = { companyId };
  if (storeId !== "ALL") {
    supplierWhere.storeId = storeId;
  }

  const suppliers = await prisma.supplier.findMany({
    where: supplierWhere,
    select: { totalOwed: true },
  });

  const supplierDebt = suppliers.reduce(
    (sum, supplier) => sum + toNumber(supplier.totalOwed),
    0
  );

  // Monthly finance
  const monthlyMap = {};
  sales.forEach((sale) => {
    const month = sale.createdAt.toISOString().slice(0, 7);

    if (!monthlyMap[month]) {
      monthlyMap[month] = {
        month,
        revenue: 0,
        profit: 0,
      };
    }

    monthlyMap[month].revenue += toNumber(sale.totalAmount);
    monthlyMap[month].profit += calculateProfit(sale.saleItems);
  });

  const monthlyFinance = Object.values(monthlyMap).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  return {
    totalRevenue,
    grossProfit,
    profitMargin,
    vatCollected,
    discounts,
    customerCredit,
    supplierDebt,
    paymentMethods,
    monthlyFinance,
  };
};