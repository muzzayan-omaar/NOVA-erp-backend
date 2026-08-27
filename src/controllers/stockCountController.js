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

    // Don't allow a second unresolved count on the same store at once —
    // covers both actively-open counts and ones already awaiting GM review.
    const existingUnresolved = await prisma.stockCount.findFirst({
      where: { companyId, storeId, status: { in: ["OPEN", "PENDING_REVIEW"] } },
    });

    if (existingUnresolved) {
      return res.status(400).json({
        message:
          existingUnresolved.status === "OPEN"
            ? "A stock count is already in progress for this store"
            : "A stock count for this store is already awaiting GM review",
        stockCountId: existingUnresolved.id,
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
 * While a count is still OPEN, anyone other than a GM gets a blind view —
 * systemQuantity and variance are stripped so the person physically
 * counting can't just copy what the system already expects. This is the
 * honest limit of a software-only blind count: it removes the number from
 * this screen, it can't stop someone from checking Inventory separately.
 * Once a count moves to review or beyond, full detail is visible to
 * everyone with access — nothing stays hidden after the fact.
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
        reviewedBy: { select: { id: true, name: true } },
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

    const isBlind = role !== "GENERAL_MANAGER" && stockCount.status === "OPEN";

    if (isBlind) {
      stockCount.items = stockCount.items.map((item) => ({
        ...item,
        systemQuantity: null,
        variance: null,
      }));
    }

    res.json({ ...stockCount, isBlind });
  } catch (err) {
    console.error("GET STOCK COUNT ERROR:", err);
    res.status(500).json({ message: "Failed to fetch stock count" });
  }
};

/**
 * UPDATE COUNTED QUANTITIES
 * Bulk-save physical counts before submitting for review.
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
      return res.status(400).json({ message: "This stock count is no longer open for counting" });
    }

    await Promise.all(
      items.map((item) =>
        prisma.stockCountItem.update({
          where: { id: item.itemId },
          data: { countedQuantity: Number(item.countedQuantity) },
        })
      )
    );

    // Still return the blind shape here too — no reason to leak system
    // quantities through the save response either.
    const updated = await prisma.stockCount.findFirst({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    const isBlind = role !== "GENERAL_MANAGER" && updated.status === "OPEN";
    if (isBlind) {
      updated.items = updated.items.map((item) => ({ ...item, systemQuantity: null, variance: null }));
    }

    res.json({ ...updated, isBlind });
  } catch (err) {
    console.error("UPDATE STOCK COUNT ITEMS ERROR:", err);
    res.status(500).json({ message: "Failed to save counts" });
  }
};

/**
 * SUBMIT STOCK COUNT FOR REVIEW
 * Locks in variances and notifies the GM — but does NOT touch stock or
 * create any inventory movements yet. Nothing changes on the real ledger
 * until a GM explicitly approves it.
 * POST /api/stock-counts/:id/submit
 */
export const submitStockCount = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId: contextStoreId, role, userId } = req.context;

    const where = { id, companyId };
    if (role !== "GENERAL_MANAGER") {
      where.storeId = contextStoreId;
    }

    const stockCount = await prisma.stockCount.findFirst({
      where,
      include: { items: { include: { product: true } }, store: true },
    });

    if (!stockCount) {
      return res.status(404).json({ message: "Stock count not found" });
    }

    if (stockCount.status !== "OPEN") {
      return res.status(400).json({ message: "This stock count has already been submitted" });
    }

    const uncounted = stockCount.items.filter((i) => i.countedQuantity === null);
    if (uncounted.length > 0) {
      return res.status(400).json({
        message: `${uncounted.length} item(s) still need a physical count before this can be submitted`,
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
      }

      await tx.stockCount.update({
        where: { id: stockCount.id },
        data: { status: "PENDING_REVIEW" },
      });
    });

    await createAuditLog({
      userId,
      companyId,
      storeId: stockCount.storeId,
      action: "STOCK_COUNT_SUBMITTED",
      entityType: "stock_count",
      entityId: stockCount.id,
      metadata: {
        totalItems: stockCount.items.length,
        discrepancyCount: discrepancies.length,
        totalShrinkageValue,
        totalOverageValue,
      },
    });

    const generalManagers = await prisma.user.findMany({
      where: { companyId, role: "GENERAL_MANAGER", isActive: true },
      select: { id: true },
    });

    await Promise.all(
      generalManagers.map((gm) =>
        createNotification({
          companyId,
          storeId: stockCount.storeId,
          userId: gm.id,
          title: "Stock Count Awaiting Review",
          message:
            totalShrinkageValue > 0
              ? `${stockCount.store.name} — UGX ${totalShrinkageValue.toLocaleString()} in possible missing stock across ${discrepancies.length} item(s). Review before it takes effect.`
              : `${stockCount.store.name} — stock count submitted with ${discrepancies.length} discrepancy(ies), awaiting your approval.`,
          type: "INVENTORY",
          priority: totalShrinkageValue > 0 ? "HIGH" : "MEDIUM",
          uniqueKey: `STOCK_COUNT_REVIEW_${stockCount.id}`,
        })
      )
    );

    res.json({
      message: "Submitted for GM review — no stock has changed yet",
      discrepancyCount: discrepancies.length,
      totalShrinkageValue,
      totalOverageValue,
    });
  } catch (err) {
    console.error("SUBMIT STOCK COUNT ERROR:", err);
    res.status(500).json({ message: "Failed to submit stock count" });
  }
};

/**
 * GET PENDING STOCK COUNTS — GM-only queue.
 * GET /api/stock-counts/pending/review
 */
export const getPendingStockCounts = async (req, res) => {
  try {
    const { companyId } = req.context;

    const counts = await prisma.stockCount.findMany({
      where: { companyId, status: "PENDING_REVIEW" },
      include: {
        store: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        items: { include: { product: { select: { name: true, buyingPrice: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const shaped = counts.map((c) => {
      const discrepancies = c.items.filter((i) => i.variance !== 0);
      const shrinkageValue = c.items
        .filter((i) => i.variance < 0)
        .reduce((sum, i) => sum + Math.abs(i.variance) * (i.product.buyingPrice || 0), 0);

      return {
        id: c.id,
        store: c.store,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        discrepancyCount: discrepancies.length,
        shrinkageValue,
        items: c.items,
      };
    });

    res.json(shaped);
  } catch (err) {
    console.error("GET PENDING STOCK COUNTS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch pending stock counts" });
  }
};

/**
 * APPROVE STOCK COUNT — GM only. This is the moment the real ledger
 * finally changes: stock corrections and inventory movements are only
 * created now, not at submission time.
 * POST /api/stock-counts/:id/approve
 */
export const approveStockCount = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, userId } = req.context;

    const stockCount = await prisma.stockCount.findFirst({
      where: { id, companyId },
      include: { items: { include: { product: true } } },
    });

    if (!stockCount) return res.status(404).json({ message: "Stock count not found" });
    if (stockCount.status !== "PENDING_REVIEW") {
      return res.status(400).json({ message: "This stock count is not awaiting review" });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of stockCount.items) {
        if (item.variance === 0 || item.variance === null) continue;

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
            reason: `Stock count reconciliation (count ${stockCount.id.slice(0, 8)}), approved`,
          },
        });
      }

      await tx.stockCount.update({
        where: { id: stockCount.id },
        data: { status: "COMPLETED", completedAt: new Date(), reviewedById: userId },
      });
    });

    await createAuditLog({
      userId,
      companyId,
      storeId: stockCount.storeId,
      action: "STOCK_COUNT_APPROVED",
      entityType: "stock_count",
      entityId: stockCount.id,
      metadata: { itemCount: stockCount.items.length },
    });

    res.json({ message: "Stock count approved — corrections applied" });
  } catch (err) {
    console.error("APPROVE STOCK COUNT ERROR:", err);
    res.status(500).json({ message: "Failed to approve stock count" });
  }
};

/**
 * REJECT STOCK COUNT — GM only. Nothing on the real ledger is ever
 * touched; a rejected count simply requires a fresh recount if needed.
 * POST /api/stock-counts/:id/reject
 * body: { rejectionReason }
 */
export const rejectStockCount = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const { companyId, userId } = req.context;

    const stockCount = await prisma.stockCount.findFirst({ where: { id, companyId } });
    if (!stockCount) return res.status(404).json({ message: "Stock count not found" });
    if (stockCount.status !== "PENDING_REVIEW") {
      return res.status(400).json({ message: "This stock count is not awaiting review" });
    }

    await prisma.stockCount.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason,
        reviewedById: userId,
        completedAt: new Date(),
      },
    });

    await createAuditLog({
      userId,
      companyId,
      storeId: stockCount.storeId,
      action: "STOCK_COUNT_REJECTED",
      entityType: "stock_count",
      entityId: id,
      metadata: { rejectionReason },
    });

    res.json({ message: "Stock count rejected — no changes were made to stock" });
  } catch (err) {
    console.error("REJECT STOCK COUNT ERROR:", err);
    res.status(500).json({ message: "Failed to reject stock count" });
  }
};