import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { resetDb, seedCompany, authHeader } from "./helpers/db.js";

let ctx;
let sale;

beforeEach(async () => {
  await resetDb();
  ctx = await seedCompany();

  const res = await request(app)
    .post("/api/sales")
    .set(authHeader(ctx.cashier))
    .send({
      items: [{ productId: ctx.product.id, quantity: 5 }],
      paymentMethod: "CASH",
    });

  sale = res.body;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Void request/approval flow", () => {
  it("cashier can request a void without manager credentials, stock stays put until approved", async () => {
    const res = await request(app)
      .post(`/api/sales/${sale.id}/request-void`)
      .set(authHeader(ctx.cashier))
      .send({ reason: "Rang up wrong item" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PENDING_VOID");

    const product = await prisma.product.findUnique({ where: { id: ctx.product.id } });
    expect(product.stockQuantity).toBe(45); // still decremented, not yet reversed
  });

  it("branch manager cannot approve — only GM can", async () => {
    await request(app)
      .post(`/api/sales/${sale.id}/request-void`)
      .set(authHeader(ctx.cashier))
      .send({ reason: "Test" });

    const res = await request(app)
      .post(`/api/sales/${sale.id}/approve`)
      .set(authHeader(ctx.branchManager));

    expect(res.status).toBe(403);
  });

  it("GM approval reverses stock and finalizes as VOID", async () => {
    await request(app)
      .post(`/api/sales/${sale.id}/request-void`)
      .set(authHeader(ctx.cashier))
      .send({ reason: "Test" });

    const res = await request(app).post(`/api/sales/${sale.id}/approve`).set(authHeader(ctx.gm));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("VOID");

    const product = await prisma.product.findUnique({ where: { id: ctx.product.id } });
    expect(product.stockQuantity).toBe(50); // fully restored
  });

  it("GM rejection reverts the sale to COMPLETED without touching stock", async () => {
    await request(app)
      .post(`/api/sales/${sale.id}/request-void`)
      .set(authHeader(ctx.cashier))
      .send({ reason: "Test" });

    const res = await request(app)
      .post(`/api/sales/${sale.id}/reject`)
      .set(authHeader(ctx.gm))
      .send({ rejectionReason: "Not a valid reason" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");

    const product = await prisma.product.findUnique({ where: { id: ctx.product.id } });
    expect(product.stockQuantity).toBe(45); // untouched throughout
  });
});
