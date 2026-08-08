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

describe("POST /api/sales", () => {
  it("creates a sale, decrements stock, computes 18% VAT correctly", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set(authHeader(ctx.cashier))
      .send({
        items: [{ productId: ctx.product.id, quantity: 2 }],
        paymentMethod: "CASH",
      });

    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(4000); // 2 x 2000
    expect(res.body.vatAmount).toBe(720); // 18% of 4000
    expect(res.body.totalAmount).toBe(4720);

    const product = await prisma.product.findUnique({ where: { id: ctx.product.id } });
    expect(product.stockQuantity).toBe(48); // 50 - 2
  });

  it("rejects a sale that exceeds available stock", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set(authHeader(ctx.cashier))
      .send({
        items: [{ productId: ctx.product.id, quantity: 999 }],
        paymentMethod: "CASH",
      });

    expect(res.status).toBe(400);

    const product = await prisma.product.findUnique({ where: { id: ctx.product.id } });
    expect(product.stockQuantity).toBe(50); // unchanged
  });

  it("is idempotent on clientReferenceId — retrying doesn't double-charge or double-decrement stock", async () => {
    const clientReferenceId = "test-offline-uuid-1";

    const first = await request(app)
      .post("/api/sales")
      .set(authHeader(ctx.cashier))
      .send({
        items: [{ productId: ctx.product.id, quantity: 3 }],
        paymentMethod: "CASH",
        clientReferenceId,
      });

    expect(first.status).toBe(201);

    // Simulate the offline queue retrying the exact same request
    const retry = await request(app)
      .post("/api/sales")
      .set(authHeader(ctx.cashier))
      .send({
        items: [{ productId: ctx.product.id, quantity: 3 }],
        paymentMethod: "CASH",
        clientReferenceId,
      });

    expect(retry.status).toBe(200); // returns existing, doesn't create
    expect(retry.body.id).toBe(first.body.id);

    const salesCount = await prisma.sale.count({ where: { clientReferenceId } });
    expect(salesCount).toBe(1); // only ever one sale, not two

    const product = await prisma.product.findUnique({ where: { id: ctx.product.id } });
    expect(product.stockQuantity).toBe(47); // decremented only once (50 - 3)
  });
});