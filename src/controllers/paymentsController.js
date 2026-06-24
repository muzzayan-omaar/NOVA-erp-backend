import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getPaymentSummary = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
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
      total += sale.totalAmount || 0;

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
          // simple split fallback (you can improve later)
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
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};