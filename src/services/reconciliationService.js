import prisma from "../lib/prisma.js";

const DEFAULT_DATE_TOLERANCE_DAYS = 3;
const DEFAULT_AMOUNT_TOLERANCE = 1000; // UGX — allows for bank fees/rounding, not a real discrepancy

// Only BANK_TRANSFER-tagged records are candidates. Card and Mobile Money
// settle into the bank on delayed, batched timing that a same-day match
// can't honestly represent — scoped out on purpose, not an oversight.
export const matchBankStatement = async (companyId, storeId, statementRows, dateToleranceDays = DEFAULT_DATE_TOLERANCE_DAYS) => {
  if (statementRows.length === 0) {
    return { results: [], unmatchedInternal: [] };
  }

  const dates = statementRows.map((r) => new Date(r.date));
  const minDate = new Date(Math.min(...dates));
  minDate.setDate(minDate.getDate() - dateToleranceDays);
  const maxDate = new Date(Math.max(...dates));
  maxDate.setDate(maxDate.getDate() + dateToleranceDays);

  const [bankSalePayments, bankCustomerPayments, bankExpenses] = await Promise.all([
    prisma.salePayment.findMany({
      where: {
        method: "BANK_TRANSFER",
        createdAt: { gte: minDate, lte: maxDate },
        sale: { companyId, storeId },
      },
      include: { sale: { include: { customer: true } } },
    }),
    prisma.customerPayment.findMany({
      where: { method: "BANK_TRANSFER", companyId, storeId, createdAt: { gte: minDate, lte: maxDate } },
      include: { customer: true },
    }),
    prisma.expense.findMany({
      where: { method: "BANK_TRANSFER", companyId, storeId, createdAt: { gte: minDate, lte: maxDate } },
    }),
  ]);

  const candidates = [
    ...bankSalePayments.map((p) => ({
      type: "SALE_PAYMENT",
      id: p.id,
      date: p.createdAt,
      amount: p.amount,
      direction: "IN",
      description: `Sale to ${p.sale.customer?.name || "walk-in customer"}`,
    })),
    ...bankCustomerPayments.map((p) => ({
      type: "CUSTOMER_PAYMENT",
      id: p.id,
      date: p.createdAt,
      amount: p.amount,
      direction: "IN",
      description: `Payment from ${p.customer?.name || "customer"}`,
    })),
    ...bankExpenses.map((e) => ({
      type: "EXPENSE",
      id: e.id,
      date: e.createdAt,
      amount: e.amount,
      direction: "OUT",
      description: `${e.category}${e.description ? " - " + e.description : ""}`,
    })),
  ];

  const usedCandidateIds = new Set();
  const results = [];

  for (const row of statementRows) {
    const rowDate = new Date(row.date);
    const rowAmount = Math.abs(Number(row.amount));
    const direction = Number(row.amount) >= 0 ? "IN" : "OUT";

    const potentialMatches = candidates.filter((c) => {
      const key = `${c.type}_${c.id}`;
      if (usedCandidateIds.has(key)) return false;
      if (c.direction !== direction) return false;
      const daysDiff = Math.abs((rowDate - new Date(c.date)) / (1000 * 60 * 60 * 24));
      if (daysDiff > dateToleranceDays) return false;
      const amountDiff = Math.abs(c.amount - rowAmount);
      return amountDiff <= DEFAULT_AMOUNT_TOLERANCE;
    });

    if (potentialMatches.length === 1) {
      usedCandidateIds.add(`${potentialMatches[0].type}_${potentialMatches[0].id}`);
      results.push({ ...row, status: "MATCHED", match: potentialMatches[0] });
    } else if (potentialMatches.length > 1) {
      results.push({ ...row, status: "MULTIPLE_CANDIDATES", candidates: potentialMatches });
    } else {
      results.push({ ...row, status: "UNMATCHED" });
    }
  }

  const unmatchedInternal = candidates.filter((c) => !usedCandidateIds.has(`${c.type}_${c.id}`));

  return { results, unmatchedInternal };
};