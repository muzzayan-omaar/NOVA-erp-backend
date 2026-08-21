import prisma from "../lib/prisma.js";

// GET customers for current store
export const getCustomers = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;

    const customers = await prisma.customer.findMany({
      where: { companyId, storeId },
      orderBy: { createdAt: "desc" },
    });

    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// CREATE customer — totalCredit always starts at 0, never accepted from the client
export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, creditLimit } = req.body;
    const { companyId, storeId } = req.context;

    const customer = await prisma.customer.create({
      data: {
        companyId, storeId, name, phone, email,
        totalCredit: 0,
        creditLimit: Number(creditLimit) || 0,
      },
    });

    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// UPDATE customer — contact details only; totalCredit is derived from real
// credit sales and payments, not editable here
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, creditLimit } = req.body;
    const { companyId, storeId } = req.context;

    const existing = await prisma.customer.findFirst({ where: { id, companyId, storeId } });
    if (!existing) return res.status(404).json({ message: "Customer not found" });

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name, phone, email,
        ...(creditLimit !== undefined && { creditLimit: Number(creditLimit) }),
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

// GET /api/customers/:id/detail — real analytics + payment history
export const getCustomerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId } = req.context;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId, storeId },
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const [creditSales, payments] = await Promise.all([
      prisma.sale.findMany({
        where: { customerId: id, companyId, paymentMethod: "CREDIT" },
        include: { saleItems: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.customerPayment.findMany({
        where: { customerId: id, companyId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const activeCreditSales = creditSales.filter((s) => s.status === "COMPLETED");
    const totalCreditIssued = activeCreditSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      customer,
      creditSales,
      payments,
      analytics: {
        creditSaleCount: activeCreditSales.length,
        totalCreditIssued,
        totalPaid,
        currentlyOwed: customer.totalCredit,
        lastSaleDate: creditSales[0]?.createdAt || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/customers/:id/pay — records a real payment, reduces the balance
export const recordCustomerPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, notes } = req.body;
    const { companyId, storeId, userId } = req.context;

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: "Enter a valid payment amount" });
    }

    const customer = await prisma.customer.findFirst({ where: { id, companyId, storeId } });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const [updatedCustomer, payment] = await prisma.$transaction([
      prisma.customer.update({
        where: { id },
        data: { totalCredit: { decrement: amt } },
      }),
      prisma.customerPayment.create({
        data: {
          companyId,
          storeId,
          customerId: id,
          amount: amt,
          method: method || "CASH",
          notes,
          createdById: userId,
        },
      }),
    ]);

    res.json({ customer: updatedCustomer, payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};