import prisma from "../../lib/prisma.js";

import {
  getToday,
  toNumber,
  calculateProfit,
} from "./analyticsHelper.js";

export const dashboardAnalytics = async (
  companyId,
  storeId
) => {

    const saleWhere = {};

if (storeId !== "ALL") {
  saleWhere.storeId = storeId;
}

const sales = await prisma.sale.findMany({
    
  where: saleWhere,

  include: {
    user: true,

    saleItems: {
      include: {
        product: true,
      },
    },
  },
});

console.log("ANALYTICS FILTER", {
    companyId,
    storeId
});

console.log(
    "SALES FOUND",
    sales.length
);

const totalRevenue = sales.reduce(
  (sum, sale) => sum + toNumber(sale.totalAmount),
  0
);

const totalTransactions = sales.length;

const today = getToday();

const todaySales = sales.filter(
  (sale) => new Date(sale.createdAt) >= today
);

const todayRevenue = todaySales.reduce(
  (sum, sale) => sum + toNumber(sale.totalAmount),
  0
);

const totalProfit = sales.reduce(
  (sum, sale) => sum + calculateProfit(sale.saleItems),
  0
);

const todayProfit = todaySales.reduce(
  (sum, sale) => sum + calculateProfit(sale.saleItems),
  0
);

const averageTransaction =
  totalTransactions === 0
    ? 0
    : totalRevenue / totalTransactions;

    const inventoryWhere = {
  companyId,
};

if (storeId !== "ALL") {
  inventoryWhere.storeId = storeId;
}

const products = await prisma.product.findMany({
  where: inventoryWhere,

  select: {
    buyingPrice: true,
    stockQuantity: true,
  },
});

const inventoryValue = products.reduce(
  (sum, product) =>
    sum +
    toNumber(product.buyingPrice) *
      toNumber(product.stockQuantity),
  0
);

const customers = await prisma.customer.findMany({
  where: inventoryWhere,

  select: {
    totalCredit: true,
  },
});

const customerCredit = customers.reduce(
  (sum, customer) =>
    sum + toNumber(customer.totalCredit),
  0
);

const supplierWhere = {
  companyId,
};

if (storeId !== "ALL") {
  supplierWhere.storeId = storeId;
}

const suppliers = await prisma.supplier.findMany({
  where: supplierWhere,

  select: {
    totalOwed: true,
  },
});

const supplierDebt = suppliers.reduce(
  (sum, supplier) =>
    sum + toNumber(supplier.totalOwed),
  0
);

const productMap = {};

sales.forEach((sale) => {
  sale.saleItems.forEach((item) => {
    if (!productMap[item.productId]) {
      productMap[item.productId] = {
        name: item.product.name,
        qty: 0,
      };
    }

    productMap[item.productId].qty += item.quantity;
  });
});

const topProducts = Object.values(productMap)
  .sort((a, b) => b.qty - a.qty)
  .slice(0, 8);

  const lowStock = await prisma.product.findMany({
  where: {
    ...inventoryWhere,

    stockQuantity: {
      lte: 10,
    },
  },

  select: {
    id: true,
    name: true,
    stockQuantity: true,
  },
});

return {
  totalRevenue,
  totalTransactions,

  todayRevenue,
  todayTransactions: todaySales.length,

  totalProfit,
  todayProfit,

  averageTransaction,

  inventoryValue,

  customerCredit,

  supplierDebt,

  topProducts,

  lowStock,
};
};

