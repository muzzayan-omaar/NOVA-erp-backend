import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET all customers
export const getCustomers = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, totalCredit } = req.body;

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email,
        totalCredit: Number(totalCredit) || 0,
        storeId: req.user?.storeId || req.body.storeId, // adjust if no auth yet
      },
    });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, phone, email, totalCredit } = req.body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        email,
        totalCredit: Number(totalCredit),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.customer.delete({
      where: { id },
    });

    res.json({ message: "Customer deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};