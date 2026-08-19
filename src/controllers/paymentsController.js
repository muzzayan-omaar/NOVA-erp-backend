import prisma from "../lib/prisma.js";

// GET /api/payments/summary — today's totals, real data only
export const getPaymentSummary = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sales = await prisma.sale.findMany({
      where: { companyId, storeId, status: "COMPLETED", createdAt: { gte: startOfDay } },
      include: { payments: true },
    });

    let cash = 0, mobile = 0, card = 0, credit = 0, mixed = 0, total = 0;

    sales.forEach((sale) => {
      total += sale.totalAmount;

      if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach((p) => {
          switch (p.method) {
            case "CASH": cash += p.amount; break;
            case "MOBILE_MONEY": mobile += p.amount; break;
            case "CARD": card += p.amount; break;
            case "CREDIT": credit += p.amount; break;
          }
        });
      } else {
        // Legacy sale from before the payment ledger existed
        switch (sale.paymentMethod) {
          case "CASH": cash += sale.totalAmount; break;
          case "MOBILE_MONEY": mobile += sale.totalAmount; break;
          case "CARD": card += sale.totalAmount; break;
          case "CREDIT": credit += sale.totalAmount; break;
          case "MIXED": mixed += sale.totalAmount; break;
        }
      }
    });

    res.json({ cash, mobile, card, credit, mixed, total, transactionCount: sales.length });
  } catch (error) {
    console.error("PAYMENT SUMMARY ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/payments/transactions — filterable transaction list
export const getTransactions = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { method, from, to, search, limit } = req.query;

    const where = { companyId, storeId, status: "COMPLETED" };

    if (method) where.paymentMethod = method;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        saleItems: true,
        payments: true,                    // ← added
      },
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : 200,
    });

    const filtered = search
      ? sales.filter(
          (s) =>
            s.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.fiscalReceiptId?.toLowerCase().includes(search.toLowerCase())
        )
      : sales;

    res.json(filtered);
  } catch (error) {
    console.error("GET TRANSACTIONS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/payments/transactions/:id — full detail for receipt view/reprint
export const getTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId } = req.context;

    const sale = await prisma.sale.findFirst({
      where: { id, companyId, storeId },
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        saleItems: { include: { product: { select: { id: true, name: true } } } },
        payments: true,                    // ← added
      },
    });

    if (!sale) return res.status(404).json({ message: "Transaction not found" });

    res.json(sale);
  } catch (error) {
    console.error("GET TRANSACTION DETAIL ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};