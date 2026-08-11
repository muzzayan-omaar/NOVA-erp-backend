import prisma from "../src/lib/prisma.js";

const run = async () => {
  const bundles = await Promise.all([
    prisma.bundle.upsert({
      where: { code: "MULTI_BRANCH" },
      update: {},
      create: {
        code: "MULTI_BRANCH",
        name: "Multi-Branch",
        description: "Manage multiple stores and cross-branch reporting",
        featureKeys: ["stores", "reports"],
        price: 20000,
        sortOrder: 1,
      },
    }),
    prisma.bundle.upsert({
      where: { code: "TEAM_PAYROLL" },
      update: {},
      create: {
        code: "TEAM_PAYROLL",
        name: "Team & Payroll",
        description: "Add staff accounts and run payroll",
        featureKeys: ["users", "payroll"],
        price: 30000,
        sortOrder: 2,
      },
    }),
    prisma.bundle.upsert({
      where: { code: "FINANCE_OVERSIGHT" },
      update: {},
      create: {
        code: "FINANCE_OVERSIGHT",
        name: "Finance & Oversight",
        description: "Expense tracking and the audit trail",
        featureKeys: ["expenses", "audit"],
        price: 25000,
        sortOrder: 3,
      },
    }),
    prisma.bundle.upsert({
      where: { code: "SUPPLIERS_PROCUREMENT" },
      update: {},
      create: {
        code: "SUPPLIERS_PROCUREMENT",
        name: "Suppliers & Procurement",
        description: "Track suppliers and payments owed",
        featureKeys: ["suppliers", "payments"],
        price: 15000,
        sortOrder: 4,
      },
    }),
  ]);

  const [multiBranch, teamPayroll, financeOversight, suppliers] = bundles;

  const starter = await prisma.package.upsert({
    where: { code: "STARTER" },
    update: {},
    create: {
      code: "STARTER",
      name: "Starter",
      description: "For a single shop just getting going",
      price: 50000,
      maxStores: 1,
      maxUsers: 3,
      sortOrder: 1,
    },
  });

  const growth = await prisma.package.upsert({
    where: { code: "GROWTH" },
    update: {},
    create: {
      code: "GROWTH",
      name: "Growth",
      description: "For a shop with staff and multiple branches",
      price: 120000,
      maxStores: 3,
      maxUsers: 10,
      sortOrder: 2,
    },
  });

  const pro = await prisma.package.upsert({
    where: { code: "PRO" },
    update: {},
    create: {
      code: "PRO",
      name: "Pro",
      description: "Full platform, every bundle included",
      price: 200000,
      maxStores: 10,
      maxUsers: 30,
      sortOrder: 3,
    },
  });

  const link = async (packageId, bundleId) => {
    await prisma.packageBundle.upsert({
      where: { packageId_bundleId: { packageId, bundleId } },
      update: {},
      create: { packageId, bundleId },
    });
  };

  await link(growth.id, teamPayroll.id);
  await link(growth.id, financeOversight.id);

  await link(pro.id, multiBranch.id);
  await link(pro.id, teamPayroll.id);
  await link(pro.id, financeOversight.id);
  await link(pro.id, suppliers.id);

  await Promise.all([
    prisma.billingCycle.upsert({
      where: { code: "MONTHLY" },
      update: {},
      create: { code: "MONTHLY", name: "Monthly", payMonths: 1, bonusMonths: 0, sortOrder: 1 },
    }),
    prisma.billingCycle.upsert({
      where: { code: "QUARTERLY" },
      update: {},
      create: { code: "QUARTERLY", name: "Quarterly", payMonths: 3, bonusMonths: 1, sortOrder: 2 },
    }),
    prisma.billingCycle.upsert({
      where: { code: "ANNUAL" },
      update: {},
      create: { code: "ANNUAL", name: "Annual", payMonths: 12, bonusMonths: 2, sortOrder: 3 },
    }),
  ]);

  console.log("Catalog seeded: 4 bundles, 3 packages, 3 billing cycles");
  process.exit(0);
};

run();