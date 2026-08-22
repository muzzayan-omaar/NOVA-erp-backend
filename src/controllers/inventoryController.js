import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

/**
 * GET ALL INVENTORY MOVEMENTS — now filterable, and includes transfer store info
 */
export const getMovements = async (req, res) => {
  try {
    const { type, productId, from, to } = req.query;

    const where = {
      companyId: req.context.companyId,
      storeId: req.context.storeId,
    };

    if (type) where.type = type;
    if (productId) where.productId = productId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: true,
        createdBy: { select: { id: true, name: true, role: true } },
        sourceStore: { select: { id: true, name: true } },
        targetStore: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(movements);
  } catch (error) {
    console.error("GET MOVEMENTS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch inventory movements" });
  }
};

/**
 * ADJUST STOCK
 */
export const adjustStock = async (req, res) => {
  try {
    const { productId, quantity, type, reason } = req.body;

    if (!productId || !quantity || !type) {
      return res.status(400).json({ message: "Product, quantity and movement type are required" });
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      return res.status(400).json({ message: "Quantity must be greater than zero" });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found in current store" });
    }

    let newStock = product.stockQuantity || 0;

    if (type === "IN") newStock += qty;
    if (type === "OUT" || type === "SALE") newStock -= qty;
    if (type === "ADJUSTMENT") newStock = qty;

    if (newStock < 0) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: newStock },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: req.context.companyId,
          storeId: req.context.storeId,
          productId: product.id,
          createdById: req.context.userId,
          type,
          quantity: qty,
          reason,
        },
      });

      return { updatedProduct, movement };
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId: req.context.companyId,
      storeId: req.context.storeId,
      action: "INVENTORY_ADJUSTED",
      entityType: "inventory_movement",
      entityId: result.movement.id,
      metadata: { productId, type, quantity: qty, newStock },
    });

    res.json({
      message: "Stock updated successfully",
      product: result.updatedProduct,
      movement: result.movement,
    });
  } catch (error) {
    console.error("ADJUST STOCK ERROR:", error);
    res.status(500).json({ message: "Failed to adjust stock" });
  }
};

import { createNotification } from "../modules/notifications/notification.service.js";

/**
 * DISPATCH TRANSFER — decrements source stock immediately (goods are
 * physically leaving), but does NOT touch the destination at all yet.
 * Nothing arrives anywhere until a receive confirms it.
 * POST /api/inventory/transfer
 */
export const dispatchTransfer = async (req, res) => {
  try {
    const { productId, targetStoreId, mode, quantity, reason } = req.body;
    const { companyId, storeId: sourceStoreId, userId } = req.context;

    if (!productId || !targetStoreId || !mode) {
      return res.status(400).json({ message: "Product, destination store, and mode are required" });
    }
    if (targetStoreId === sourceStoreId) {
      return res.status(400).json({ message: "Choose a different store to transfer to" });
    }

    const targetStore = await prisma.store.findFirst({
      where: { id: targetStoreId, companyId, isActive: true },
    });
    if (!targetStore) return res.status(404).json({ message: "Destination store not found" });

    const source = await prisma.product.findFirst({
      where: { id: productId, companyId, storeId: sourceStoreId },
    });
    if (!source) return res.status(404).json({ message: "Product not found in current store" });

    let sentQty;
    if (mode === "RELOCATE") {
      sentQty = source.stockQuantity || 0;
      if (sentQty <= 0) {
        return res.status(400).json({ message: "Nothing in stock to relocate" });
      }
    } else if (mode === "CLONE") {
      sentQty = Number(quantity);
      if (!sentQty || sentQty <= 0) {
        return res.status(400).json({ message: "Enter a quantity to transfer" });
      }
      if (sentQty > (source.stockQuantity || 0)) {
        return res.status(400).json({ message: "Insufficient stock to transfer that quantity" });
      }
    } else {
      return res.status(400).json({ message: "Invalid transfer mode" });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: source.id },
        data: { stockQuantity: { decrement: sentQty } },
      });

      await tx.inventoryMovement.create({
        data: {
          companyId, storeId: sourceStoreId, productId: source.id,
          createdById: userId, type: "TRANSFER_OUT", quantity: sentQty,
          reason: reason || `Dispatched to ${targetStore.name}`,
          sourceStoreId, targetStoreId,
        },
      });

      const transit = await tx.stockTransit.create({
        data: {
          companyId, sourceStoreId, targetStoreId,
          productId: source.id, mode, quantitySent: sentQty,
          reason, dispatchedById: userId,
        },
      });

      return transit;
    });

    await createAuditLog({
      userId, companyId, storeId: sourceStoreId,
      action: "TRANSFER_DISPATCHED",
      entityType: "stock_transit",
      entityId: result.id,
      metadata: { productName: source.name, quantity: sentQty, targetStoreName: targetStore.name, mode },
    });

    res.status(201).json({ message: "Dispatched — awaiting receipt at destination", transit: result });
  } catch (error) {
    console.error("DISPATCH TRANSFER ERROR:", error);
    res.status(500).json({ message: "Failed to dispatch transfer" });
  }
};

/**
 * GET TRANSITS — both directions for the current store.
 * GET /api/inventory/transits
 */
export const getTransits = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { status } = req.query;

    const where = {
      companyId,
      OR: [{ sourceStoreId: storeId }, { targetStoreId: storeId }],
    };
    if (status) where.status = status;

    const transits = await prisma.stockTransit.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true, buyingPrice: true } },
        sourceStore: { select: { name: true } },
        targetStore: { select: { name: true } },
        dispatchedBy: { select: { name: true } },
        receivedBy: { select: { name: true } },
      },
      orderBy: { dispatchedAt: "desc" },
    });

    res.json(transits);
  } catch (error) {
    console.error("GET TRANSITS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch transits" });
  }
};

/**
 * RECEIVE TRANSFER — only the destination store confirms this. If what
 * arrived doesn't match what was dispatched, only the real received
 * amount is credited anywhere — the shortfall is a flagged, valued loss.
 * POST /api/inventory/transits/:id/receive
 */
export const receiveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantityReceived } = req.body;
    const { companyId, storeId, userId } = req.context;

    const transit = await prisma.stockTransit.findFirst({
      where: { id, companyId, targetStoreId: storeId },
      include: { product: true, sourceStore: true },
    });

    if (!transit) return res.status(404).json({ message: "Transit not found for this store" });
    if (transit.status !== "IN_TRANSIT") {
      return res.status(400).json({ message: "This transfer has already been resolved" });
    }

    const received = Number(quantityReceived);
    if (received == null || received < 0) {
      return res.status(400).json({ message: "Enter the quantity actually received" });
    }

    const variance = transit.quantitySent - received;
    const hasVariance = Math.abs(variance) > 0.001;
    const finalStatus = hasVariance ? "VARIANCE" : "RECEIVED";

    const result = await prisma.$transaction(async (tx) => {
      let resultProduct;

      if (transit.mode === "RELOCATE") {
        resultProduct = await tx.product.update({
          where: { id: transit.productId },
          data: { storeId, stockQuantity: received },
        });
      } else {
        const familyId = transit.product.linkedFamilyId || transit.product.id;

        if (!transit.product.linkedFamilyId) {
          await tx.product.update({ where: { id: transit.product.id }, data: { linkedFamilyId: familyId } });
        }

        let twin = await tx.product.findFirst({
          where: { companyId, storeId, linkedFamilyId: familyId },
        });

        if (twin) {
          resultProduct = await tx.product.update({
            where: { id: twin.id },
            data: { stockQuantity: { increment: received } },
          });
        } else if (received > 0) {
          let sku = `${transit.product.sku}-${storeId.slice(0, 4).toUpperCase()}`;
          let attempt = 0;
          while (await tx.product.findFirst({ where: { companyId, sku } })) {
            attempt++;
            sku = `${transit.product.sku}-${storeId.slice(0, 4).toUpperCase()}${attempt}`;
          }

          resultProduct = await tx.product.create({
            data: {
              companyId, storeId,
              name: transit.product.name, sku,
              barcode: transit.product.barcode,
              buyingPrice: transit.product.buyingPrice,
              sellingPrice: transit.product.sellingPrice,
              unitType: transit.product.unitType,
              stockQuantity: received,
              linkedFamilyId: familyId,
            },
          });
        }
      }

      if (received > 0) {
        await tx.inventoryMovement.create({
          data: {
            companyId, storeId, productId: resultProduct?.id || transit.productId,
            createdById: userId, type: "TRANSFER_IN", quantity: received,
            reason: `Received from ${transit.sourceStore.name}${hasVariance ? " (variance flagged)" : ""}`,
            sourceStoreId: transit.sourceStoreId, targetStoreId: storeId,
          },
        });
      }

      return tx.stockTransit.update({
        where: { id },
        data: {
          quantityReceived: received,
          status: finalStatus,
          receivedById: userId,
          receivedAt: new Date(),
        },
      });
    });

    const varianceValue = hasVariance ? Math.abs(variance) * (transit.product.buyingPrice || 0) : 0;

    await createAuditLog({
      userId, companyId, storeId,
      action: hasVariance ? "TRANSFER_VARIANCE" : "TRANSFER_RECEIVED",
      entityType: "stock_transit",
      entityId: id,
      metadata: {
        productName: transit.product.name,
        quantitySent: transit.quantitySent,
        quantityReceived: received,
        variance,
        varianceValue,
      },
    });

    if (hasVariance) {
      const gms = await prisma.user.findMany({
        where: { companyId, role: "GENERAL_MANAGER", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        gms.map((gm) =>
          createNotification({
            companyId,
            storeId,
            userId: gm.id,
            title: "Stock Transfer Variance",
            message: `${transit.product.name}: dispatched ${transit.quantitySent}, only ${received} arrived — UGX ${varianceValue.toLocaleString()} missing.`,
            type: "INVENTORY",
            priority: "HIGH",
            uniqueKey: `TRANSIT_VARIANCE_${id}`,
          })
        )
      );
    }

    res.json({ message: hasVariance ? "Received with variance flagged" : "Received in full", transit: result, varianceValue });
  } catch (error) {
    console.error("RECEIVE TRANSFER ERROR:", error);
    res.status(500).json({ message: "Failed to receive transfer" });
  }
};