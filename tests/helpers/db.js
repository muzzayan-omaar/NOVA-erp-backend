import prisma from "../../src/lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Deletes in FK-safe order — children before parents.
export const resetDb = async () => {
  await prisma.stockCountItem.deleteMany();
  await prisma.stockCount.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.subscription.deleteMany();   // ← added
  await prisma.company.deleteMany();
};

// Builds a full company + store + one user per role, ready to test against.
export const seedCompany = async () => {
  const company = await prisma.company.create({
    data: { name: "Test Traders", country: "Uganda" },
  });

  // Give the seeded company an active subscription so middleware doesn't 402
  await prisma.subscription.create({
    data: {
      companyId: company.id,
      plan: "BASIC",
      status: "ACTIVE",
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const store = await prisma.store.create({
    data: {
      companyId: company.id,
      name: "Head Office",
      isHeadOffice: true,
    },
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const gm = await prisma.user.create({
    data: {
      companyId: company.id,
      storeId: store.id,
      activeStoreId: store.id,
      name: "Test GM",
      email: "gm@test.com",
      passwordHash,
      role: "GENERAL_MANAGER",
    },
  });

  const branchManager = await prisma.user.create({
    data: {
      companyId: company.id,
      storeId: store.id,
      activeStoreId: store.id,
      name: "Test Branch Manager",
      email: "manager@test.com",
      passwordHash,
      role: "BRANCH_MANAGER",
    },
  });

  const cashier = await prisma.user.create({
    data: {
      companyId: company.id,
      storeId: store.id,
      activeStoreId: store.id,
      name: "Test Cashier",
      email: "cashier@test.com",
      passwordHash,
      role: "CASHIER",
    },
  });

  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      storeId: store.id,
      name: "Test Product",
      sku: "TEST-001",
      buyingPrice: 1000,
      sellingPrice: 2000,
      stockQuantity: 50,
    },
  });

  return { company, store, gm, branchManager, cashier, product };
};

// Mints a JWT the same way authController does, without hitting /login —
// keeps sale/void/expense tests fast and independent of auth test coverage.
export const tokenFor = (user) => {
  return jwt.sign(
    {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

export const authHeader = (user) => ({
  Authorization: `Bearer ${tokenFor(user)}`,
});