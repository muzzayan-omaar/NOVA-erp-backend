import prisma from "../lib/prisma.js";

// GET suppliers for active store
export const getSuppliers = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId,
        storeId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(suppliers);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// CREATE supplier
export const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, totalOwed } = req.body;

    const { companyId, storeId } = req.context;

    const supplier = await prisma.supplier.create({
      data: {
        companyId,
        storeId,

        name,
        phone,
        email,
        address,

        totalOwed: Number(totalOwed) || 0,
      },
    });

    res.json(supplier);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// UPDATE supplier
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, totalOwed } = req.body;
    const { companyId, storeId } = req.context;

    const existing = await prisma.supplier.findFirst({
      where: { id, companyId, storeId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        phone,
        email,
        address,
        totalOwed: Number(totalOwed) || 0,
      },
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
