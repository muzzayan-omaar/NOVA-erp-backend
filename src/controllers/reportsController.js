import prisma from "../lib/prisma.js";

const startOfDayUTC = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDayUTC = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

export const getDayBook = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { date } = req.query;

    const gte = startOfDayUTC(date);
    const lte = endOfDayUTC(date);
    const range = { gte, lte };

    const [sales, expenses, movements, poReceived, customerPayments, supplierPayments] =
      await Promise.all([
        prisma.sale.findMany({
          where: { companyId, storeId, status: "COMPLETED", createdAt: range },
          include: { user: { select: { name: true } }, customer: { select: { name: true } } },
        }),
        prisma.expense.findMany({
          where: { companyId, storeId, createdAt: range },
          include: { createdBy: { select: { name: true } } },
        }),
        prisma.inventoryMovement.findMany({
          where: {
            companyId, storeId, createdAt: range,
            type: { in: ["IN", "OUT", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT"] },
          },
          include: { product: { select: { name: true } }, createdBy: { select: { name: true } } },
        }),
        prisma.purchaseOrder.findMany({
          where: { companyId, storeId, status: "RECEIVED", receivedAt: range },
          include: { supplier: { select: { name: true } }, items: true },
        }),
        prisma.customerPayment.findMany({
          where: { companyId, storeId, createdAt: range },
          include: { customer: { select: { name: true } } },
        }),
        prisma.expense.findMany({
          where: { companyId, storeId, category: "Supplier Payment", createdAt: range },
          include: { supplier: { select: { name: true } } },
        }),
      ]);

    const entries = [
      ...sales.map((s) => ({
        type: "SALE",
        time: s.createdAt,
        description: `Sale to ${s.customer?.name || "walk-in customer"} by ${s.user?.name || "—"}`,
        amount: s.totalAmount,
        direction: "IN",
      })),
      ...expenses
        .filter((e) => e.category !== "Supplier Payment")
        .map((e) => ({
          type: "EXPENSE",
          time: e.createdAt,
          description: `${e.category}${e.description ? ` — ${e.description}` : ""} (${e.createdBy?.name || "—"})`,
          amount: e.amount,
          direction: "OUT",
        })),
      ...movements.map((m) => ({
        type: `STOCK_${m.type}`,
        time: m.createdAt,
        description: `${m.type.replace("_", " ")}: ${m.product?.name || "—"} × ${m.quantity} (${m.createdBy?.name || "—"})`,
        amount: null,
        direction: null,
      })),
      ...poReceived.map((po) => ({
        type: "PURCHASE_RECEIVED",
        time: po.receivedAt,
        description: `Received order from ${po.supplier?.name || "—"} — ${po.items.length} item(s)`,
        amount: po.items.reduce((sum, i) => sum + (i.quantityReceived || 0) * i.unitCost, 0),
        direction: "STOCK",
      })),
      ...customerPayments.map((p) => ({
        type: "CUSTOMER_PAYMENT",
        time: p.createdAt,
        description: `Payment received from ${p.customer?.name || "—"}`,
        amount: p.amount,
        direction: "IN",
      })),
      ...supplierPayments.map((e) => ({
        type: "SUPPLIER_PAYMENT",
        time: e.createdAt,
        description: `Payment to ${e.supplier?.name || "supplier"}`,
        amount: e.amount,
        direction: "OUT",
      })),
    ].sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json({ date: gte, entries });
  } catch (err) {
    console.error("DAY BOOK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { from, to } = req.query;

    const where = { companyId, storeId, status: "COMPLETED" };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = startOfDayUTC(from);
      if (to) where.createdAt.lte = endOfDayUTC(to);
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true } },
        saleItems: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const totals = sales.reduce(
      (acc, s) => ({
        subtotal: acc.subtotal + (s.subtotal || 0),
        vatAmount: acc.vatAmount + (s.vatAmount || 0),
        discount: acc.discount + (s.discount || 0),
        totalAmount: acc.totalAmount + s.totalAmount,
      }),
      { subtotal: 0, vatAmount: 0, discount: 0, totalAmount: 0 }
    );

    res.json({ sales, totals, count: sales.length });
  } catch (err) {
    console.error("SALES REPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getStockSummaryReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const products = await prisma.product.findMany({
      where: { companyId, storeId, isActive: true },
      orderBy: { name: "asc" },
    });

    const rows = products.map((p) => {
      const qty = p.stockQuantity || 0;
      const stockValue = qty * p.buyingPrice;
      const potentialRevenue = qty * p.sellingPrice;
      const potentialProfit = potentialRevenue - stockValue;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: qty,
        buyingPrice: p.buyingPrice,
        sellingPrice: p.sellingPrice,
        stockValue,
        potentialProfit,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        stockValue: acc.stockValue + r.stockValue,
        potentialProfit: acc.potentialProfit + r.potentialProfit,
        quantity: acc.quantity + r.quantity,
      }),
      { stockValue: 0, potentialProfit: 0, quantity: 0 }
    );

    res.json({ rows, totals });
  } catch (err) {
    console.error("STOCK SUMMARY ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getProfitLossReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { from, to } = req.query;

    const dateRange = {};
    if (from) dateRange.gte = startOfDayUTC(from);
    if (to) dateRange.lte = endOfDayUTC(to);
    const hasRange = from || to;

    const salesWhere = { companyId, storeId, status: "COMPLETED" };
    if (hasRange) salesWhere.createdAt = dateRange;

    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: { saleItems: { include: { product: { select: { buyingPrice: true } } } } },
    });

    const revenue = sales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
    const cogs = sales.reduce(
      (sum, s) =>
        sum + s.saleItems.reduce((s2, i) => s2 + i.quantity * (i.product?.buyingPrice || 0), 0),
      0
    );
    const grossProfit = revenue - cogs;

    const expenseWhere = {
  companyId, storeId,
  category: { not: "Supplier Payment" },
  expenseType: "OPERATING",
};
    if (hasRange) expenseWhere.createdAt = dateRange;

    const expenses = await prisma.expense.findMany({ where: expenseWhere });
    const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const payrollWhere = { companyId, storeId, status: "PAID" };
    if (hasRange) payrollWhere.paidAt = dateRange;

    const payroll = await prisma.payroll.findMany({ where: payrollWhere });
    const payrollCost = payroll.reduce((sum, p) => sum + p.netPay, 0);

    const capExWhere = { companyId, storeId, expenseType: "CAPITAL" };
    if (hasRange) capExWhere.createdAt = dateRange;
    const capitalExpenses = await prisma.expense.findMany({ where: capExWhere });
    const capitalSpend = capitalExpenses.reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = operatingExpenses + payrollCost;
    const netProfit = grossProfit - totalExpenses;

    res.json({
  revenue,
  cogs,
  grossProfit,
  operatingExpenses,
  payrollCost,
  totalExpenses,
  netProfit,
  capitalSpend,          // ← add this
  expenseBreakdown: expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {}),
});
  } catch (err) {
    console.error("PROFIT & LOSS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getCashFlowReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { from, to } = req.query;

    const dateRange = {};
    if (from) dateRange.gte = startOfDayUTC(from);
    if (to) dateRange.lte = endOfDayUTC(to);
    const hasRange = from || to;

    // --- Corrected sales fetch for split-credit support ---
    const salesWhere = { companyId, storeId, status: "COMPLETED" };
    if (hasRange) salesWhere.createdAt = dateRange;

    const salesForCashFlow = await prisma.sale.findMany({
      where: salesWhere,
      include: { payments: true },
    });

    let cashInFromSales = 0;
    salesForCashFlow.forEach((sale) => {
      if (sale.payments && sale.payments.length > 0) {
        // New payment ledger: only count non-CREDIT portions
        cashInFromSales += sale.payments
          .filter((p) => p.method !== "CREDIT")
          .reduce((sum, p) => sum + p.amount, 0);
      } else if (sale.paymentMethod !== "CREDIT") {
        // Legacy sales (before payment ledger existed)
        cashInFromSales += sale.totalAmount;
      }
    });
    // -------------------------------------------------------

    const customerPaymentWhere = { companyId, storeId };
    if (hasRange) customerPaymentWhere.createdAt = dateRange;

    const expenseWhere = { companyId, storeId };
    if (hasRange) expenseWhere.createdAt = dateRange;

    const payrollWhere = { companyId, storeId, status: "PAID" };
    if (hasRange) payrollWhere.paidAt = dateRange;

    const [customerPayments, expenses, payroll] = await Promise.all([
      prisma.customerPayment.findMany({ where: customerPaymentWhere, select: { amount: true } }),
      prisma.expense.findMany({ where: expenseWhere, select: { amount: true } }),
      prisma.payroll.findMany({ where: payrollWhere, select: { netPay: true } }),
    ]);

    const cashInFromCustomers = customerPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalCashIn = cashInFromSales + cashInFromCustomers;

    const cashOutExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const cashOutPayroll = payroll.reduce((sum, p) => sum + p.netPay, 0);
    const totalCashOut = cashOutExpenses + cashOutPayroll;

    res.json({
      cashInFromSales,
      cashInFromCustomers,
      totalCashIn,
      cashOutExpenses,
      cashOutPayroll,
      totalCashOut,
      netCashFlow: totalCashIn - totalCashOut,
    });
  } catch (err) {
    console.error("CASH FLOW ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getReceivablesPayablesReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const [customers, suppliers] = await Promise.all([
      prisma.customer.findMany({
        where: { companyId, storeId, totalCredit: { gt: 0 } },
        orderBy: { totalCredit: "desc" },
      }),
      prisma.supplier.findMany({
        where: { companyId, storeId, totalOwed: { gt: 0 } },
        orderBy: { totalOwed: "desc" },
      }),
    ]);

    res.json({
      receivables: {
        customers,
        total: customers.reduce((sum, c) => sum + c.totalCredit, 0),
      },
      payables: {
        suppliers,
        total: suppliers.reduce((sum, s) => sum + s.totalOwed, 0),
      },
    });
  } catch (err) {
    console.error("RECEIVABLES/PAYABLES ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getVatSummaryReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { from, to } = req.query;

    const where = { companyId, storeId, status: "COMPLETED" };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = startOfDayUTC(from);
      if (to) where.createdAt.lte = endOfDayUTC(to);
    }

    const sales = await prisma.sale.findMany({
      where,
      select: { subtotal: true, vatAmount: true, totalAmount: true, createdAt: true },
    });

    const taxableSales = sales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
    const vatCollected = sales.reduce((sum, s) => sum + (s.vatAmount || 0), 0);

    res.json({
      taxableSales,
      vatCollected,
      totalSales: taxableSales + vatCollected,
      transactionCount: sales.length,
      vatRate: 0.18,
    });
  } catch (err) {
    console.error("VAT SUMMARY ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * SUPPLIER AGING — accounts-payable aging (0-30 / 31-60 / 61-90 / 90+ days).
 * Reconstructed from real PurchaseOrder receipt dates, with payments
 * applied FIFO against the oldest outstanding orders first — standard
 * aging practice, not an estimate.
 * GET /api/reports/supplier-aging
 */
export const getSupplierAgingReport = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const suppliers = await prisma.supplier.findMany({
      where: { companyId, storeId, totalOwed: { gt: 0 } },
    });

    const today = new Date();
    const rows = [];

    for (const supplier of suppliers) {
      const orders = await prisma.purchaseOrder.findMany({
        where: { companyId, supplierId: supplier.id, status: "RECEIVED" },
        include: { items: true },
        orderBy: { receivedAt: "asc" },
      });

      const payments = await prisma.expense.findMany({
        where: { companyId, supplierId: supplier.id, category: "Supplier Payment" },
        orderBy: { createdAt: "asc" },
      });

      let paidPool = payments.reduce((sum, p) => sum + p.amount, 0);

      const buckets = { current: 0, days31to60: 0, days61to90: 0, days90plus: 0 };

      for (const order of orders) {
        const orderTotal = order.items.reduce(
          (sum, i) => sum + (i.quantityReceived || 0) * i.unitCost,
          0
        );

        let remaining = orderTotal;
        if (paidPool > 0) {
          const applied = Math.min(paidPool, remaining);
          remaining -= applied;
          paidPool -= applied;
        }

        if (remaining <= 0) continue;

        const ageDays = Math.floor((today - new Date(order.receivedAt)) / (1000 * 60 * 60 * 24));

        if (ageDays <= 30) buckets.current += remaining;
        else if (ageDays <= 60) buckets.days31to60 += remaining;
        else if (ageDays <= 90) buckets.days61to90 += remaining;
        else buckets.days90plus += remaining;
      }

      const totalOwed = buckets.current + buckets.days31to60 + buckets.days61to90 + buckets.days90plus;

      if (totalOwed > 0) {
        rows.push({ supplierId: supplier.id, supplierName: supplier.name, ...buckets, totalOwed });
      }
    }

    const totals = rows.reduce(
      (acc, r) => ({
        current: acc.current + r.current,
        days31to60: acc.days31to60 + r.days31to60,
        days61to90: acc.days61to90 + r.days61to90,
        days90plus: acc.days90plus + r.days90plus,
        totalOwed: acc.totalOwed + r.totalOwed,
      }),
      { current: 0, days31to60: 0, days61to90: 0, days90plus: 0, totalOwed: 0 }
    );

    res.json({ rows, totals });
  } catch (err) {
    console.error("SUPPLIER AGING ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};