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

describe("Stock Count", () => {
  it("snapshots current stock quantity when a count is started", async () => {
    const res = await request(app)
      .post("/api/stock-counts")
      .set(authHeader(ctx.branchManager))
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].systemQuantity).toBe(50);
    expect(res.body.items[0].countedQuantity).toBeNull();
  });

  it("blocks a second OPEN count on the same store", async () => {
    await request(app).post("/api/stock-counts").set(authHeader(ctx.branchManager)).send({});

    const res = await request(app)
      .post("/api/stock-counts")
      .set(authHeader(ctx.branchManager))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.stockCountId).toBeDefined();
  });

  it("rejects completion while any item is still uncounted", async () => {
    const created = await request(app)
      .post("/api/stock-counts")
      .set(authHeader(ctx.branchManager))
      .send({});

    const res = await request(app)
      .post(`/api/stock-counts/${created.body.id}/complete`)
      .set(authHeader(ctx.branchManager));

    expect(res.status).toBe(400);
    expect(res.body.missingItems).toContain("Test Product");
  });

  it("completing applies stock correction and reports shrinkage value", async () => {
    const created = await request(app)
      .post("/api/stock-counts")
      .set(authHeader(ctx.branchManager))
      .send({});

    const itemId = created.body.items[0].id;

    // Physical count found only 45, but system said 50 — 5 units missing
    await request(app)
      .patch(`/api/stock-counts/${created.body.id}/items`)
      .set(authHeader(ctx.branchManager))
      .send({ items: [{ itemId, countedQuantity: 45 }] });

    const res = await request(app)
      .post(`/api/stock-counts/${created.body.id}/complete`)
      .set(authHeader(ctx.branchManager));

    expect(res.status).toBe(200);
    expect(res.body.discrepancies).toHaveLength(1);
    expect(res.body.discrepancies[0].variance).toBe(-5);
    expect(res.body.totalShrinkageValue).toBe(5000); // 5 units x buyingPrice 1000

    const product = await prisma.product.findUnique({ where: { id: ctx.product.id } });
    expect(product.stockQuantity).toBe(45); // corrected to match physical count

    const movement = await prisma.inventoryMovement.findFirst({
      where: { productId: ctx.product.id, type: "ADJUSTMENT" },
    });
    expect(movement).not.toBeNull();
  });

  it("branch manager only sees counts for their own store, GM sees all", async () => {
    // Second store + branch manager, same company
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
    await prisma.product.create({
      data: {
        companyId: ctx.company.id,
        storeId: store2.id,
        name: "Branch 2 Product",
        sku: "B2-001",
        buyingPrice: 500,
        sellingPrice: 1000,
        stockQuantity: 10,
      },
    });

    await request(app).post("/api/stock-counts").set(authHeader(ctx.branchManager)).send({});
    await request(app).post("/api/stock-counts").set(authHeader(manager2)).send({});

    const managerView = await request(app)
      .get("/api/stock-counts")
      .set(authHeader(ctx.branchManager));

    expect(managerView.body).toHaveLength(1);
    expect(managerView.body[0].storeId).toBe(ctx.store.id);

    const gmView = await request(app).get("/api/stock-counts").set(authHeader(ctx.gm));

    expect(gmView.body).toHaveLength(2); // sees both branches
  });
});
