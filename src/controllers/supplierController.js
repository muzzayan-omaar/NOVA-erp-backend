import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET all suppliers
export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, totalOwed } = req.body;

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone,
        email,
        address,
        totalOwed: Number(totalOwed) || 0,
      },
    });

    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, phone, email, address, totalOwed } = req.body;

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        phone,
        email,
        address,
        totalOwed: Number(totalOwed),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.supplier.delete({
      where: { id },
    });

    res.json({ message: "Supplier deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};