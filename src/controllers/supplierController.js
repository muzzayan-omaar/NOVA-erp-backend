import prisma from "../lib/prisma.js";

// GET suppliers for active store
export const getSuppliers = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const suppliers = await prisma.supplier.findMany({
      where: { companyId, storeId },
      orderBy: { createdAt: "desc" },
    });

    res.json(suppliers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// CREATE supplier — totalOwed always starts at 0, never accepted from the client
export const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const { companyId, storeId } = req.context;

    const supplier = await prisma.supplier.create({
      data: { companyId, storeId, name, phone, email, address, totalOwed: 0 },
    });

    res.json(supplier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// UPDATE supplier — contact details only; totalOwed is derived from real
// purchase orders and payments, not editable here anymore
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    const { companyId, storeId } = req.context;

    const existing = await prisma.supplier.findFirst({
      where: { id, companyId, storeId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: { name, phone, email, address },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE supplier
export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId } = req.context;

    const existing = await prisma.supplier.findFirst({
      where: { id, companyId, storeId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    await prisma.supplier.delete({ where: { id } });

    res.json({ message: "Supplier deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/suppliers/:id/detail — real analytics: spend, orders, payment history
export const getSupplierDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId } = req.context;

    const supplier = await prisma.supplier.findFirst({
      where: { id, companyId, storeId },
    });
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const [orders, payments] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { supplierId: id, companyId },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { supplierId: id, companyId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const receivedOrders = orders.filter((o) => o.status === "RECEIVED");
    const totalSpent = receivedOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + (i.quantityReceived || 0) * i.unitCost, 0),
      0
    );
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      supplier,
      orders,
      payments,
      analytics: {
        orderCount: orders.length,
        receivedOrderCount: receivedOrders.length,
        totalSpent,
        totalPaid,
        currentlyOwed: supplier.totalOwed,
        lastOrderDate: orders[0]?.createdAt || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/suppliers/:id/pay — records a real payment, creates a linked
// Expense (so it shows up in your existing Expense/Finance analytics),
// and reduces the running balance.
export const recordSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, notes } = req.body;
    const { companyId, storeId, userId } = req.context;

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: "Enter a valid payment amount" });
    }

    const supplier = await prisma.supplier.findFirst({ where: { id, companyId, storeId } });
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const [updatedSupplier, expense] = await prisma.$transaction([
      prisma.supplier.update({
        where: { id },
        data: { totalOwed: { decrement: amt } },
      }),
      prisma.expense.create({
        data: {
          companyId,
          storeId,
          category: "Supplier Payment",
          description: notes || `Payment to ${supplier.name}`,
          amount: amt,
          createdById: userId,
          supplierId: id,
        },
      }),
    ]);

    res.json({ supplier: updatedSupplier, expense });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};