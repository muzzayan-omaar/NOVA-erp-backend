import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";
import { createNotification } from "../modules/notifications/notification.service.js";

/**
 * CREATE STOCK COUNT
 * Snapshots the current system quantity of every active product
 * in the caller's active store. POST /api/stock-counts
 */
export const createStockCount = async (req, res) => {
  try {
    const { companyId, storeId, userId } = req.context;

    if (!storeId || storeId === "ALL") {
      return res
        .status(400)
        .json({ message: "Select a specific store before starting a stock count" });
    }

    // Don't allow two open counts on the same store at once — confusing to reconcile.
    const existingOpen = await prisma.stockCount.findFirst({
      where: { companyId, storeId, status: "OPEN" },
    });

    if (existingOpen) {
      return res.status(400).json({
        message: "A stock count is already in progress for this store",
        stockCountId: existingOpen.id,
      });
    }

    const products = await prisma.product.findMany({
      where: { companyId, storeId, isActive: true },
      select: { id: true, stockQuantity: true },
    });

    if (products.length === 0) {
      return res.status(400).json({ message: "No active products found for this store" });
    }

    const stockCount = await prisma.stockCount.create({
      data: {
        companyId,
        storeId,
        createdById: userId,
        status: "OPEN",
        items: {
          create: products.map((p) => ({
            productId: p.id,
            systemQuantity: p.stockQuantity || 0,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    await createAuditLog({
      userId,
      companyId,
      storeId,
      action: "STOCK_COUNT_STARTED",
      entityType: "stock_count",
      entityId: stockCount.id,
      metadata: { itemCount: products.length },
    });

    res.status(201).json(stockCount);
  } catch (err) {
    console.error("CREATE STOCK COUNT ERROR:", err);
    res.status(500).json({ message: "Failed to start stock count" });
  }
};

/**
 * GET STOCK COUNTS (history)
 * GM sees company-wide, branch manager sees only their store.
 * GET /api/stock-counts
 */
export const getStockCounts = async (req, res) => {
  try {
    const { companyId, storeId: contextStoreId, role } = req.context;

    const where = { companyId };

    if (role !== "GENERAL_MANAGER") {
      where.storeId = contextStoreId;
    }

    const counts = await prisma.stockCount.findMany({
      where,
      include: {
        store: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach a lightweight summary so the list view doesn't need a second call
    const withSummary = counts.map((c) => {
      const discrepancies = c.items.filter((i) => i.variance !== null && i.variance !== 0);
      const shrinkage = c.items.filter((i) => (i.variance || 0) < 0).length;

      return {
        id: c.id,
        storeId: c.storeId,
        store: c.store,
        createdBy: c.createdBy,
        status: c.status,
        createdAt: c.createdAt,
        completedAt: c.completedAt,
        totalItems: c.items.length,
        discrepancyCount: discrepancies.length,
        shrinkageCount: shrinkage,
      };
    });

    res.json(withSummary);
  } catch (err) {
    console.error("GET STOCK COUNTS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch stock counts" });
  }
};

/**
 * GET ONE STOCK COUNT (with items)
 * GET /api/stock-counts/:id
 */
export const getStockCountById = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId: contextStoreId, role } = req.context;

    const where = { id, companyId };
    if (role !== "GENERAL_MANAGER") {
      where.storeId = contextStoreId;
    }

    const stockCount = await prisma.stockCount.findFirst({
      where,
      include: {
        store: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unitType: true, buyingPrice: true },
            },
          },
        },
      },
    });

    if (!stockCount) {
      return res.status(404).json({ message: "Stock count not found" });
    }

    res.json(stockCount);
  } catch (err) {
    console.error("GET STOCK COUNT ERROR:", err);
    res.status(500).json({ message: "Failed to fetch stock count" });
  }
};

/**
 * UPDATE COUNTED QUANTITIES
 * Bulk-save physical counts before completing.
 * PATCH /api/stock-counts/:id/items
 * body: { items: [{ itemId, countedQuantity }] }
 */
export const updateStockCountItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const { companyId, storeId: contextStoreId, role } = req.context;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    const where = { id, companyId };
    if (role !== "GENERAL_MANAGER") {
      where.storeId = contextStoreId;
    }

    const stockCount = await prisma.stockCount.findFirst({ where });

    if (!stockCount) {
      return res.status(404).json({ message: "Stock count not found" });
    }

    if (stockCount.status !== "OPEN") {
      return res.status(400).json({ message: "This stock count is already completed" });
    }

    await Promise.all(
      items.map((item) =>
        prisma.stockCountItem.update({
          where: { id: item.itemId },
          data: { countedQuantity: Number(item.countedQuantity) },
        })
      )
    );

    const updated = await prisma.stockCount.findFirst({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error("UPDATE STOCK COUNT ITEMS ERROR:", err);
    res.status(500).json({ message: "Failed to save counts" });
  }
};

/**
 * COMPLETE STOCK COUNT
 * Locks in variances, applies stock corrections, notifies every GM.
 * POST /api/stock-counts/:id/complete
 */
export const completeStockCount = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId: contextStoreId, role, userId } = req.context;

    const where = { id, companyId };
    if (role !== "GENERAL_MANAGER") {
      where.storeId = contextStoreId;
    }

    const stockCount = await prisma.stockCount.findFirst({
      where,
      include: { items: { include: { product: true } } },
    });

    if (!stockCount) {
      return res.status(404).json({ message: "Stock count not found" });
    }

    if (stockCount.status !== "OPEN") {
      return res.status(400).json({ message: "This stock count is already completed" });
    }

    const uncounted = stockCount.items.filter((i) => i.countedQuantity === null);
    if (uncounted.length > 0) {
      return res.status(400).json({
        message: `${uncounted.length} item(s) still need a physical count before this can be completed`,
        missingItems: uncounted.map((i) => i.product.name),
      });
    }

    let totalShrinkageValue = 0;
    let totalOverageValue = 0;
    const discrepancies = [];

    await prisma.$transaction(async (tx) => {
      for (const item of stockCount.items) {
        const variance = item.countedQuantity - item.systemQuantity;

        await tx.stockCountItem.update({
          where: { id: item.id },
          data: { variance },
        });

        if (variance === 0) continue;

        const varianceValue = variance * (item.product.buyingPrice || 0);
        if (variance < 0) totalShrinkageValue += Math.abs(varianceValue);
        if (variance > 0) totalOverageValue += varianceValue;

        discrepancies.push({
          productName: item.product.name,
          systemQuantity: item.systemQuantity,
          countedQuantity: item.countedQuantity,
          variance,
          value: varianceValue,
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: item.countedQuantity },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId,
            storeId: stockCount.storeId,
            productId: item.productId,
            createdById: userId,
            type: "ADJUSTMENT",
            quantity: item.countedQuantity,
            reason: `Stock count reconciliation (count ${stockCount.id.slice(0, 8)})`,
          },
        });
      }

      await tx.stockCount.update({
        where: { id: stockCount.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    });

    await createAuditLog({
      userId,
      companyId,
      storeId: stockCount.storeId,
      action: "STOCK_COUNT_COMPLETED",
      entityType: "stock_count",
      entityId: stockCount.id,
      metadata: {
        totalItems: stockCount.items.length,
        discrepancyCount: discrepancies.length,
        totalShrinkageValue,
        totalOverageValue,
        topDiscrepancies: discrepancies.sort((a, b) => a.value - b.value).slice(0, 5),
      },
    });

    // Alert every GM — shrinkage is the actual theft signal here.
    if (discrepancies.length > 0) {
      const generalManagers = await prisma.user.findMany({
        where: { companyId, role: "GENERAL_MANAGER", isActive: true },
        select: { id: true },
      });

      const store = await prisma.store.findUnique({ where: { id: stockCount.storeId } });

      await Promise.all(
        generalManagers.map((gm) =>
          createNotification({
            companyId,
            storeId: stockCount.storeId,
            userId: gm.id,
            title: totalShrinkageValue > 0 ? "Stock Shrinkage Detected" : "Stock Count Completed",
            message:
              totalShrinkageValue > 0
                ? `${store?.name || "A store"} — UGX ${totalShrinkageValue.toLocaleString()} in missing stock found across ${discrepancies.length} item(s).`
                : `${store?.name || "A store"} — stock count completed with ${discrepancies.length} discrepancy(ies).`,
            type: "INVENTORY",
            priority: totalShrinkageValue > 0 ? "HIGH" : "MEDIUM",
            uniqueKey: `STOCK_COUNT_${stockCount.id}`,
          })
        )
      );
    }

    res.json({
      message: "Stock count completed",
      discrepancies,
      totalShrinkageValue,
      totalOverageValue,
    });
  } catch (err) {
    console.error("COMPLETE STOCK COUNT ERROR:", err);
    res.status(500).json({ message: "Failed to complete stock count" });
  }
};
