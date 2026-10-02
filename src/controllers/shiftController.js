import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";
import { createNotification } from "../modules/notifications/notification.service.js";

// POST /api/shifts/open
export const openShift = async (req, res) => {
  try {
    const { openingFloat } = req.body;
    const { companyId, storeId, userId } = req.context;

    if (openingFloat === undefined || Number(openingFloat) < 0) {
      return res.status(400).json({ message: "Enter a valid opening float amount" });
    }

    const existing = await prisma.cashierShift.findFirst({
      where: { userId, status: "OPEN" },
    });
    if (existing) {
      return res.status(400).json({ message: "You already have an open shift", shift: existing });
    }

    const shift = await prisma.cashierShift.create({
      data: { companyId, storeId, userId, openingFloat: Number(openingFloat) },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "SHIFT_OPENED",
      entityType: "cashier_shift",
      entityId: shift.id,
      metadata: { openingFloat: Number(openingFloat) },
    });

    res.status(201).json(shift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/shifts/current — the calling user's own open shift, if any
export const getCurrentShift = async (req, res) => {
  try {
    const shift = await prisma.cashierShift.findFirst({
      where: { userId: req.context.userId, status: "OPEN" },
    });
    res.json(shift || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/shifts/:id/close
// Computes and locks in the three reports from real Sale/SalePayment data
// scoped to exactly this shift — never a time-window guess.
export const closeShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { countedCash } = req.body;
    const { userId, companyId, storeId } = req.context;

    if (countedCash === undefined || Number(countedCash) < 0) {
      return res.status(400).json({ message: "Enter the actual counted cash amount" });
    }

    const shift = await prisma.cashierShift.findFirst({ where: { id, userId } });
    if (!shift) return res.status(404).json({ message: "Shift not found" });
    if (shift.status !== "OPEN") {
      return res.status(400).json({ message: "This shift is already closed" });
    }

    const sales = await prisma.sale.findMany({
      where: { shiftId: id, status: "COMPLETED" },
      include: {
        payments: true,
        saleItems: { include: { product: { select: { name: true } } } },
      },
    });

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    const totalByMethod = {};
    let cashFromSales = 0;

    sales.forEach((sale) => {
      const lines = sale.payments.length > 0
        ? sale.payments
        : [{ method: sale.paymentMethod, amount: sale.totalAmount }];

      lines.forEach((p) => {
        totalByMethod[p.method] = (totalByMethod[p.method] || 0) + p.amount;
        if (p.method === "CASH") cashFromSales += p.amount;
      });
    });

    const productMap = {};
    sales.forEach((sale) => {
      sale.saleItems.forEach((item) => {
        const baseUnits = item.quantity * (item.unitConversionFactor || 1);
        if (!productMap[item.productId]) {
          productMap[item.productId] = { productId: item.productId, name: item.product.name, qty: 0, revenue: 0 };
        }
        productMap[item.productId].qty += baseUnits;
        productMap[item.productId].revenue += item.subtotal;
      });
    });
    const productMix = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

    const expectedCash = shift.openingFloat + cashFromSales;
    const cashVariance = Number(countedCash) - expectedCash;

    const updated = await prisma.cashierShift.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        countedCash: Number(countedCash),
        expectedCash,
        cashVariance,
        totalSales,
        totalByMethod,
        productMix,
        transactionCount: sales.length,
      },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "SHIFT_CLOSED",
      entityType: "cashier_shift",
      entityId: id,
      metadata: { totalSales, expectedCash, countedCash: Number(countedCash), cashVariance, transactionCount: sales.length },
    });

    if (Math.abs(cashVariance) > 1) {
      const gms = await prisma.user.findMany({
        where: { companyId, role: "GENERAL_MANAGER", isActive: true },
        select: { id: true },
      });

      const cashier = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

      await Promise.all(
        gms.map((gm) =>
          createNotification({
            companyId, storeId, userId: gm.id,
            title: cashVariance < 0 ? "Till Shortage Detected" : "Till Overage Detected",
            message: `${cashier.name}'s shift closed with a ${cashVariance < 0 ? "shortage" : "overage"} of UGX ${Math.abs(cashVariance).toLocaleString()}.`,
            type: "INVENTORY",
            priority: cashVariance < 0 ? "HIGH" : "MEDIUM",
            uniqueKey: `SHIFT_VARIANCE_${id}`,
          })
        )
      ).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/shifts — GM-only, for Shift History oversight
export const getShifts = async (req, res) => {
  try {
    const { companyId } = req.context;
    const { storeId, userId, status } = req.query;

    const where = { companyId };
    if (storeId) where.storeId = storeId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const shifts = await prisma.cashierShift.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    res.json(shifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/shifts/:id — the shift's own owner, or a GM, can view it
export const getShiftDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, userId, role } = req.context;

    const shift = await prisma.cashierShift.findFirst({
      where: { id, companyId },
      include: { user: { select: { id: true, name: true } }, store: { select: { id: true, name: true } } },
    });

    if (!shift) return res.status(404).json({ message: "Shift not found" });

    if (shift.userId !== userId && role !== "GENERAL_MANAGER") {
      return res.status(403).json({ message: "You can only view your own shift reports" });
    }

    res.json(shift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};