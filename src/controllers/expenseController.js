import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

// GET expenses for active store (or all stores if GM has "ALL" context)
export const getExpenses = async (req, res) => {
  try {
    const { companyId, storeId: contextStoreId, role } = req.context;
    const { category, from, to, storeId: queryStoreId } = req.query;

    const where = { companyId };

    if (role === "GENERAL_MANAGER") {
      // GM sees expenses across every branch by default.
      // Optional ?storeId=<id> lets them drill into one branch.
      if (queryStoreId) {
        where.storeId = queryStoreId;
      }
    } else {
      // Branch managers (and anyone else) only ever see their own store —
      // this is intentional isolation, not the bug we're fixing.
      where.storeId = contextStoreId;
    }

    if (category) where.category = category;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// CREATE expense
export const createExpense = async (req, res) => {
  try {
    const { category, description, amount } = req.body;
    const { companyId, storeId, userId } = req.context;

    if (!category || !amount) {
      return res.status(400).json({ message: "Category and amount are required" });
    }

    if (!storeId || storeId === "ALL") {
      return res.status(400).json({ message: "Select a specific store before recording an expense" });
    }

    const expense = await prisma.expense.create({
      data: {
        companyId,
        storeId,
        category,
        description,
        amount: Number(amount),
        createdById: userId,
      },
    });

    await createAuditLog({
      userId,
      companyId,
      storeId,
      action: "EXPENSE_CREATED",
      entityType: "expense",
      entityId: expense.id,
      metadata: { category, amount: Number(amount), description },
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE expense — GM only (enforced in route, double-checked here)
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, userId } = req.context;

    const existing = await prisma.expense.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await prisma.expense.delete({ where: { id } });

    await createAuditLog({
      userId,
      companyId,
      storeId: existing.storeId,
      action: "EXPENSE_DELETED",
      entityType: "expense",
      entityId: id,
      metadata: {
        category: existing.category,
        amount: existing.amount,
        description: existing.description,
        originallyCreatedBy: existing.createdById,
      },
    });

    res.json({ message: "Expense deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};