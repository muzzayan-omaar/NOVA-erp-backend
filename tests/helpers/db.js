import prisma from "../../src/lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Deletes in FK-safe order — children before parents.
export const resetDb = async () => {
   await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();

  await prisma.salePayment.deleteMany();
  await prisma.customerPayment.deleteMany();

  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();

  await prisma.inventoryMovement.deleteMany();

  // Stock counts reference products, so delete them BEFORE products
  await prisma.stockCountItem.deleteMany();
  await prisma.stockCount.deleteMany();

  await prisma.product.deleteMany();

  await prisma.expense.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.payroll.deleteMany();

  await prisma.user.deleteMany();
  await prisma.store.deleteMany();

  // Join tables & subscription first
  await prisma.subscription.deleteMany();
  await prisma.packageBundle.deleteMany();

  await prisma.package.deleteMany();
  await prisma.bundle.deleteMany();
  await prisma.company.deleteMany();
};

// Builds a full company + store + one user per role, ready to test against.
export const seedCompany = async () => {
  const company = await prisma.company.create({
    data: { name: "Test Traders", country: "Uganda" },
  });

  // ── Package + Bundle that grants the features tests need ──────────────
  const starterPackage = await prisma.package.upsert({
    where: { code: "STARTER" },
    update: {},
    create: {
      code: "STARTER",
      name: "Starter",
      price: 50000,
      maxStores: 5,
      maxUsers: 20,
    },
  });

  const coreBundle = await prisma.bundle.upsert({
    where: { code: "TEST_CORE" },
    update: {
      featureKeys: [
        "dashboard",
        "stores",
        "users",
        "products",
        "inventory",
        "sales",
        "customers",
        "payments",
        "expenses",
        "suppliers",
        "payroll",
        "reports",
        "audit",
        "billing",
        "support",
      ],
    },
    create: {
      code: "TEST_CORE",
      name: "Test Core",
      price: 0,
      featureKeys: [
        "dashboard",
        "stores",
        "users",
        "products",
        "inventory",
        "sales",
        "customers",
        "payments",
        "expenses",
        "suppliers",
        "payroll",
        "reports",
        "audit",
        "billing",
        "support",
      ],
    },
  });

  await prisma.packageBundle.upsert({
    where: {
      packageId_bundleId: {
        packageId: starterPackage.id,
        bundleId: coreBundle.id,
      },
    },
    update: {},
    create: {
      packageId: starterPackage.id,
      bundleId: coreBundle.id,
    },
  });

  await prisma.subscription.create({
    data: {
      companyId: company.id,
      packageId: starterPackage.id,
      status: "ACTIVE",
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });
  // ─────────────────────────────────────────────────────────────────────

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