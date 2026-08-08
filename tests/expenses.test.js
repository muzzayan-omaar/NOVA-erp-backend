import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { resetDb, seedCompany, authHeader } from "./helpers/db.js";

let ctx;

beforeEach(async () => {
  await resetDb();
  ctx = await seedCompany();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Expenses", () => {
  it("branch manager can create an expense", async () => {
    const res = await request(app)
      .post("/api/expenses")
      .set(authHeader(ctx.branchManager))
      .send({ category: "Transport", description: "Delivery fuel", amount: 15000 });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(15000);
  });

  it("cashier cannot create an expense", async () => {
    const res = await request(app)
      .post("/api/expenses")
      .set(authHeader(ctx.cashier))
      .send({ category: "Transport", amount: 5000 });

    expect(res.status).toBe(403);
  });

  it("branch manager cannot delete an expense — GM only", async () => {
    const created = await request(app)
      .post("/api/expenses")
      .set(authHeader(ctx.branchManager))
      .send({ category: "Rent", amount: 200000 });

    const res = await request(app)
      .delete(`/api/expenses/${created.body.id}`)
      .set(authHeader(ctx.branchManager));

    expect(res.status).toBe(403);

    const stillExists = await prisma.expense.findUnique({ where: { id: created.body.id } });
    expect(stillExists).not.toBeNull();
  });

  it("GM can delete an expense", async () => {
    const created = await request(app)
      .post("/api/expenses")
      .set(authHeader(ctx.branchManager))
      .send({ category: "Rent", amount: 200000 });

    const res = await request(app)
      .delete(`/api/expenses/${created.body.id}`)
      .set(authHeader(ctx.gm));

    expect(res.status).toBe(200);

    const gone = await prisma.expense.findUnique({ where: { id: created.body.id } });
    expect(gone).toBeNull();
  });

  it("GM sees expenses across every branch by default; branch manager sees only their own", async () => {
    const store2 = await prisma.store.create({
      data: { companyId: ctx.company.id, name: "Branch 2" },
    });
    const manager2 = await prisma.user.create({
      data: {
        companyId: ctx.company.id,
        storeId: store2.id,
        activeStoreId: store2.id,
        name: "Manager 2",
        email: "manager2@test.com",
        passwordHash: ctx.branchManager.passwordHash,
        role: "BRANCH_MANAGER",
      },
    });

    await request(app)
      .post("/api/expenses")
      .set(authHeader(ctx.branchManager))
      .send({ category: "Supplies", amount: 10000 });

    await request(app)
      .post("/api/expenses")
      .set(authHeader(manager2))
      .send({ category: "Supplies", amount: 20000 });

    const managerView = await request(app)
      .get("/api/expenses")
      .set(authHeader(ctx.branchManager));

    expect(managerView.body).toHaveLength(1);
    expect(managerView.body[0].amount).toBe(10000);

    const gmView = await request(app)
      .get("/api/expenses")
      .set(authHeader(ctx.gm));

    expect(gmView.body).toHaveLength(2); // both branches, this is the bug we fixed
  });
});