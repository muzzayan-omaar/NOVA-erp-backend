import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";
import { resetDb, seedCompany } from "./helpers/db.js";
import { dashboardAnalytics } from "../src/controllers/analytics/dashboardAnalytics.js";

let ctx;

beforeEach(async () => {
  await resetDb();
  ctx = await seedCompany();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("dashboardAnalytics — voided sales must never count as revenue", () => {
  it("excludes VOID and PENDING_VOID sales from totalRevenue", async () => {
    await prisma.sale.create({
      data: {
        companyId: ctx.company.id,
        storeId: ctx.store.id,
        userId: ctx.cashier.id,
        totalAmount: 10000,
        subtotal: 8475,
        vatAmount: 1525,
        paymentMethod: "CASH",
        status: "COMPLETED",
      },
    });

    await prisma.sale.create({
      data: {
        companyId: ctx.company.id,
        storeId: ctx.store.id,
        userId: ctx.cashier.id,
        totalAmount: 5000,
        subtotal: 4237,
        vatAmount: 763,
        paymentMethod: "CASH",
        status: "VOID",
      },
    });

    await prisma.sale.create({
      data: {
        companyId: ctx.company.id,
        storeId: ctx.store.id,
        userId: ctx.cashier.id,
        totalAmount: 3000,
        subtotal: 2542,
        vatAmount: 458,
        paymentMethod: "CASH",
        status: "PENDING_VOID",
      },
    });

    const result = await dashboardAnalytics(ctx.company.id, ctx.store.id);

    expect(result.totalRevenue).toBe(10000); // only the COMPLETED one
    expect(result.totalTransactions).toBe(1);
  });

  it("never returns data from a different company", async () => {
    const otherCompany = await prisma.company.create({ data: { name: "Other Co" } });
    const otherStore = await prisma.store.create({
      data: { companyId: otherCompany.id, name: "Other Store" },
    });
    const otherUser = await prisma.user.create({
      data: {
        companyId: otherCompany.id,
        storeId: otherStore.id,
        name: "Other Cashier",
        email: "other@test.com",
        passwordHash: "x",
        role: "CASHIER",
      },
    });

    await prisma.sale.create({
      data: {
        companyId: otherCompany.id,
        storeId: otherStore.id,
        userId: otherUser.id,
        totalAmount: 999999,
        paymentMethod: "CASH",
        status: "COMPLETED",
      },
    });

    const result = await dashboardAnalytics(ctx.company.id, ctx.store.id);

    expect(result.totalRevenue).toBe(0); // must not see the other company's sale
  });
});
