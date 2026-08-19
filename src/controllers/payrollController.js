import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";
import { calculatePAYE, calculateNssf } from "../utils/payrollTax.js";

// CREATE PAYROLL — computes real PAYE + NSSF, not hand-typed deductions
export const createPayroll = async (req, res) => {
  try {
    const {
      userId,
      basicSalary,
      allowances = 0,
      bonus = 0,
      otherDeductions = 0,
      month,
      notes,
    } = req.body;

    const { companyId, storeId, userId: createdBy } = req.context;

    if (!userId || !basicSalary || !month) {
      return res.status(400).json({ message: "Employee, basic salary, and month are required" });
    }

    const grossSalary = Number(basicSalary) + Number(allowances) + Number(bonus);
    const nssf = calculateNssf(grossSalary);
    const payeTax = calculatePAYE(grossSalary);
    const netPay = grossSalary - nssf.employee - payeTax - Number(otherDeductions);

    const payroll = await prisma.payroll.create({
      data: {
        companyId,
        storeId,
        userId,
        month,
        basicSalary: Number(basicSalary),
        allowances: Number(allowances),
        bonus: Number(bonus),
        grossSalary,
        nssfEmployee: nssf.employee,
        nssfEmployer: nssf.employer,
        payeTax,
        otherDeductions: Number(otherDeductions),
        netPay,
        notes,
      },
    });

    await createAuditLog({
      userId: createdBy,
      companyId,
      storeId,
      action: "PAYROLL_CREATED",
      entityType: "payroll",
      entityId: payroll.id,
      metadata: { month, grossSalary, netPay, payeTax, nssfTotal: nssf.employee + nssf.employer },
    });

    res.status(201).json(payroll);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// GET PAYROLL
export const getPayroll = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { month, status } = req.query;

    const where = { companyId, storeId };
    if (month) where.month = month;
    if (status) where.status = status;

    const payroll = await prisma.payroll.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(payroll);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// MARK PAYROLL AS PAID — this was entirely missing before, which meant
// no payroll record could ever count correctly in Profit & Loss or
// Cash Flow, since both filter on status "PAID".
export const markPayrollPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId, userId } = req.context;

    const existing = await prisma.payroll.findFirst({ where: { id, companyId, storeId } });
    if (!existing) return res.status(404).json({ message: "Payroll record not found" });
    if (existing.status === "PAID") {
      return res.status(400).json({ message: "This payroll record is already marked paid" });
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });

    await createAuditLog({
      userId,
      companyId,
      storeId,
      action: "PAYROLL_PAID",
      entityType: "payroll",
      entityId: id,
      metadata: { month: existing.month, netPay: existing.netPay },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// NSSF RETURN — a shaped export for the monthly NSSF filing
export const getNssfReturn = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { month } = req.query;

    if (!month) return res.status(400).json({ message: "Month is required" });

    const records = await prisma.payroll.findMany({
      where: { companyId, storeId, month },
      include: { user: { select: { name: true } } },
    });

    const rows = records.map((r) => ({
      employee: r.user?.name || "—",
      grossSalary: r.grossSalary,
      nssfEmployee: r.nssfEmployee,
      nssfEmployer: r.nssfEmployer,
      nssfTotal: r.nssfEmployee + r.nssfEmployer,
    }));

    const totals = rows.reduce(
      (acc, r) => ({
        grossSalary: acc.grossSalary + r.grossSalary,
        nssfEmployee: acc.nssfEmployee + r.nssfEmployee,
        nssfEmployer: acc.nssfEmployer + r.nssfEmployer,
        nssfTotal: acc.nssfTotal + r.nssfTotal,
      }),
      { grossSalary: 0, nssfEmployee: 0, nssfEmployer: 0, nssfTotal: 0 }
    );

    res.json({ month, rows, totals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};