import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

// CREATE PAYROLL
export const createPayroll = async (req, res) => {
  try {
    const { userId, salary, bonus = 0, deductions = 0, month } = req.body;

    const { companyId, storeId, userId: createdBy } = req.context;

    const payroll = await prisma.payroll.create({
      data: {
        companyId,

        storeId,

        userId,

        salary: Number(salary),

        bonus: Number(bonus),

        deductions: Number(deductions),

        netPay: Number(salary) + Number(bonus) - Number(deductions),

        month,
      },
    });

    await createAuditLog({
      userId: createdBy,

      action: "PAYROLL_CREATED",

      entityType: "payroll",

      entityId: payroll.id,

      metadata: payroll,

      companyId,

      storeId,
    });

    res.status(201).json(payroll);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
};

// GET PAYROLL
export const getPayroll = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const payroll = await prisma.payroll.findMany({
      where: {
        companyId,

        storeId,
      },

      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(payroll);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
};
