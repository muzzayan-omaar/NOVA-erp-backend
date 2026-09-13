import ExcelJS from "exceljs";
import prisma from "../lib/prisma.js";

// Builds a real, data-backed Excel workbook for one company — everything
// in it comes from actual database queries, nothing estimated. Scoped to
// "today" so it doubles as an end-of-day snapshot, not a full history dump.
export const generateDailySnapshot = async (companyId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [company, sales, expenses, lowStockProducts, receivables, payables] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", createdAt: { gte: startOfDay } },
      include: { user: { select: { name: true } }, customer: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { companyId, createdAt: { gte: startOfDay } },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId, isActive: true, stockQuantity: { lte: 10 } },
      orderBy: { stockQuantity: "asc" },
    }),
    prisma.customer.findMany({ where: { companyId, totalCredit: { gt: 0 } } }),
    prisma.supplier.findMany({ where: { companyId, totalOwed: { gt: 0 } } }),
  ]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalReceivables = receivables.reduce((sum, c) => sum + c.totalCredit, 0);
  const totalPayables = payables.reduce((sum, s) => sum + s.totalOwed, 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nova ERP";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [{ header: "Metric", key: "metric", width: 30 }, { header: "Value", key: "value", width: 20 }];
  summarySheet.addRows([
    { metric: "Company", value: company.name },
    { metric: "Date", value: startOfDay.toDateString() },
    { metric: "Total Revenue Today", value: totalRevenue },
    { metric: "Total Expenses Today", value: totalExpenses },
    { metric: "Net Today", value: totalRevenue - totalExpenses },
    { metric: "Transactions Today", value: sales.length },
    { metric: "Low Stock Items", value: lowStockProducts.length },
    { metric: "Total Owed To You (Receivables)", value: totalReceivables },
    { metric: "Total You Owe Suppliers (Payables)", value: totalPayables },
  ]);
  summarySheet.getRow(1).font = { bold: true };

  const salesSheet = workbook.addWorksheet("Sales Today");
  salesSheet.columns = [
    { header: "Time", key: "time", width: 20 },
    { header: "Cashier", key: "cashier", width: 20 },
    { header: "Customer", key: "customer", width: 20 },
    { header: "Payment Method", key: "method", width: 18 },
    { header: "Total (UGX)", key: "total", width: 15 },
  ];
  sales.forEach((s) => {
    salesSheet.addRow({
      time: new Date(s.createdAt).toLocaleTimeString(),
      cashier: s.user?.name || "—",
      customer: s.customer?.name || "Walk-in",
      method: s.paymentMethod,
      total: s.totalAmount,
    });
  });
  salesSheet.getRow(1).font = { bold: true };

  const expensesSheet = workbook.addWorksheet("Expenses Today");
  expensesSheet.columns = [
    { header: "Category", key: "category", width: 20 },
    { header: "Description", key: "description", width: 30 },
    { header: "Amount (UGX)", key: "amount", width: 15 },
    { header: "Recorded By", key: "by", width: 20 },
  ];
  expenses.forEach((e) => {
    expensesSheet.addRow({
      category: e.category,
      description: e.description || "",
      amount: e.amount,
      by: e.createdBy?.name || "—",
    });
  });
  expensesSheet.getRow(1).font = { bold: true };

  const lowStockSheet = workbook.addWorksheet("Low Stock");
  lowStockSheet.columns = [
    { header: "Product", key: "name", width: 30 },
    { header: "SKU", key: "sku", width: 15 },
    { header: "Stock Remaining", key: "qty", width: 18 },
  ];
  lowStockProducts.forEach((p) => {
    lowStockSheet.addRow({ name: p.name, sku: p.sku, qty: p.stockQuantity });
  });
  lowStockSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer,
    filename: `Nova_Backup_${company.name.replace(/\s+/g, "_")}_${startOfDay.toISOString().slice(0, 10)}.xlsx`,
    summary: { totalRevenue, totalExpenses, transactionCount: sales.length, lowStockCount: lowStockProducts.length },
    companyName: company.name,
  };
};