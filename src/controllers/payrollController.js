import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

export const createPayroll = async (req, res) => {
  try {
    const { userId, salary, bonus = 0, deductions = 0, month } = req.body;

    const payroll = await prisma.payroll.create({
      data: {
        userId,
        salary: parseFloat(salary),
        bonus: parseFloat(bonus),
        deductions: parseFloat(deductions),
        netPay: parseFloat(salary) + parseFloat(bonus) - parseFloat(deductions),
        month,
        storeId: req.user.storeId,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: "PAYROLL_CREATED",
      entityType: "payroll",
      entityId: payroll.id,
      metadata: payroll,
    });

    res.status(201).json(payroll);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create payroll" });
  }
};

export const getPayroll = async (req, res) => {
  try {
    const payroll = await prisma.payroll.findMany({
      where: { storeId: req.user.storeId },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payroll" });
  }
};