import prisma from "../lib/prisma.js";

export const getPaymentSummary = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sales = await prisma.sale.findMany({
      where: {
        companyId,
        storeId,
        createdAt: {
          gte: startOfDay,
        },
      },

      select: {
        totalAmount: true,
        paymentMethod: true,
      },
    });

    let cash = 0;
    let mobile = 0;
    let card = 0;
    let total = 0;

    sales.forEach((sale) => {
      total += sale.totalAmount;

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

        case "MIXED":
          // temporary fallback
          cash += sale.totalAmount * 0.4;
          mobile += sale.totalAmount * 0.3;
          card += sale.totalAmount * 0.3;

          break;
      }
    });

    res.json({
      cash,
      mobile,
      card,
      total,
      transactionCount: sales.length,
    });
  } catch (error) {
    console.error("PAYMENT SUMMARY ERROR:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};
