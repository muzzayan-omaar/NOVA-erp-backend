import prisma from "../lib/prisma.js";

export const getDashboardAnalytics = async (req, res) => {
  try {
    const storeId = req.user.storeId;

    // Get all sales for this store
    const sales = await prisma.sale.findMany({
      where: { storeId },
      include: {
        saleItems: {
          include: { product: true }
        },
        user: true
      }
    });

    // Total Revenue
    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Total Transactions
    const totalTransactions = sales.length;

    // Today's Revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySales = sales.filter(s => new Date(s.createdAt) >= today);
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Top Products
    const productMap = {};
    sales.forEach(sale => {
      sale.saleItems.forEach(item => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = {
            name: item.product.name,
            qty: 0
          };
        }
        productMap[item.productId].qty += item.quantity;
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    // Low Stock
    const lowStock = await prisma.product.findMany({
      where: {
        storeId,
        stockQuantity: { lte: 10 }
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true
      }
    });

    res.json({
      totalRevenue,
      totalTransactions,
      todayRevenue,
      todayTransactions: todaySales.length,
      topProducts,
      lowStock,
      cashierSummary: [] // Can be expanded later
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load analytics" });
  }
};

export const getAdvancedAnalytics = async (req, res) => {
  try {
    const storeId = req.user.storeId;
    const { period = "7" } = req.query; // days

    const sales = await prisma.sale.findMany({
      where: { 
        storeId,
        createdAt: {
          gte: new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        user: true,
        saleItems: true
      },
      orderBy: { createdAt: "desc" }
    });

    // Daily Sales Trend
    const dailyTrend = {};
    sales.forEach(sale => {
      const date = sale.createdAt.toISOString().split('T')[0];
      if (!dailyTrend[date]) dailyTrend[date] = { date, revenue: 0, count: 0 };
      dailyTrend[date].revenue += sale.totalAmount;
      dailyTrend[date].count += 1;
    });

    const salesTrend = Object.values(dailyTrend).sort((a,b) => a.date.localeCompare(b.date));

    // Cashier Performance
    const cashierMap = {};
    sales.forEach(sale => {
      const cashierId = sale.userId;
      if (!cashierMap[cashierId]) {
        cashierMap[cashierId] = {
          name: sale.user.name,
          totalSales: 0,
          transactionCount: 0
        };
      }
      cashierMap[cashierId].totalSales += sale.totalAmount;
      cashierMap[cashierId].transactionCount += 1;
    });

    const cashierPerformance = Object.values(cashierMap)
      .sort((a,b) => b.totalSales - a.totalSales);

    res.json({
      salesTrend,
      cashierPerformance,
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + s.totalAmount, 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load advanced analytics" });
  }
};