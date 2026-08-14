import prisma from "../lib/prisma.js";

// GET customers for current store
export const getCustomers = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        storeId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(customers);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// CREATE customer
export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, totalCredit } = req.body;

    const { companyId, storeId } = req.context;

    const customer = await prisma.customer.create({
      data: {
        companyId,
        storeId,

        name,
        phone,
        email,

        totalCredit: Number(totalCredit) || 0,
      },
    });

    res.json(customer);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// UPDATE customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, totalCredit } = req.body;
    const { companyId, storeId } = req.context;

    const existing = await prisma.customer.findFirst({
      where: { id, companyId, storeId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        email,
        totalCredit: Number(totalCredit) || 0,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId } = req.context;

    const existing = await prisma.customer.findFirst({
      where: { id, companyId, storeId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Customer not found" });
    }

    await prisma.customer.delete({ where: { id } });

    res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
