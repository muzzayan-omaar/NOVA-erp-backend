import prisma from "../lib/prisma.js";

export const getDashboardReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    // ---------- SALES ----------
    const sales = await prisma.sale.findMany({
      where: {
        companyId,
        storeId,
      },
      select: {
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const todaySales = sales
      .filter((s) => new Date(s.createdAt) >= today)
      .reduce((sum, s) => sum + s.totalAmount, 0);

    const monthSales = sales
      .filter((s) => new Date(s.createdAt) >= currentMonth)
      .reduce((sum, s) => sum + s.totalAmount, 0);

    // ---------- PRODUCTS ----------
    const products = await prisma.product.findMany({
      where: {
        companyId,
        storeId,
      },
      select: {
        stockQuantity: true,
        buyingPrice: true,
      },
    });

    const stockValue = products.reduce(
      (sum, p) => sum + (p.stockQuantity || 0) * p.buyingPrice,
      0
    );

    const lowStock = products.filter(
      (p) => (p.stockQuantity || 0) <= 5
    ).length;

    // ---------- CUSTOMERS ----------
    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        storeId,
      },
      select: {
        totalCredit: true,
      },
    });

    const customerCredit = customers.reduce(
      (sum, c) => sum + c.totalCredit,
      0
    );

    // ---------- SUPPLIERS ----------
    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId,
        storeId,
      },
      select: {
        totalOwed: true,
      },
    });

    const supplierOwed = suppliers.reduce(
      (sum, s) => sum + s.totalOwed,
      0
    );

    // ---------- PAYROLL ----------
    const payroll = await prisma.payroll.findMany({
      where: {
        companyId,
        storeId,
      },
      select: {
        netPay: true,
      },
    });

    const payrollCost = payroll.reduce(
      (sum, p) => sum + p.netPay,
      0
    );

    // ---------- PAYMENTS ----------
    let cash = 0;
    let mobile = 0;
    let card = 0;

    sales.forEach((sale) => {
      switch (sale.paymentMethod) {
        case "CASH":
          cash += sale.totalAmount;
          break;

        case "MOBILE_MONEY":
          mobile += sale.totalAmount;
          break;

        case "CARD":
          card += sale.totalAmount;
          break;
      }
    });

    res.json({
      sales: {
        today: todaySales,
        month: monthSales,
        transactions: sales.length,
      },

      inventory: {
        products: products.length,
        stockValue,
        lowStock,
      },

      customers: {
        count: customers.length,
        credit: customerCredit,
      },

      suppliers: {
        count: suppliers.length,
        owed: supplierOwed,
      },

      payroll: {
        employees: payroll.length,
        cost: payrollCost,
      },

      payments: {
        cash,
        mobile,
        card,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
};