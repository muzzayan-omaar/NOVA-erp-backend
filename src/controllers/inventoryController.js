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

/**
 * TRANSFER STOCK — supports two modes:
 *   RELOCATE — the whole product record moves to another store
 *   CLONE    — a linked twin at the destination store receives the quantity,
 *              source keeps the rest
 * POST /api/inventory/transfer
 */
export const transferStock = async (req, res) => {
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
    if (!targetStore) {
      return res.status(404).json({ message: "Destination store not found" });
    }

    const source = await prisma.product.findFirst({
      where: { id: productId, companyId, storeId: sourceStoreId },
    });
    if (!source) {
      return res.status(404).json({ message: "Product not found in current store" });
    }

    if (mode === "RELOCATE") {
      const movedQuantity = source.stockQuantity || 0;

      const result = await prisma.$transaction(async (tx) => {
        const relocated = await tx.product.update({
          where: { id: source.id },
          data: { storeId: targetStoreId },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId, storeId: sourceStoreId, productId: source.id,
            createdById: userId, type: "TRANSFER_OUT", quantity: movedQuantity,
            reason: reason || `Relocated to ${targetStore.name}`,
            sourceStoreId, targetStoreId,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId, storeId: targetStoreId, productId: source.id,
            createdById: userId, type: "TRANSFER_IN", quantity: movedQuantity,
            reason: reason || `Relocated from source store`,
            sourceStoreId, targetStoreId,
          },
        });

        return relocated;
      });

      await createAuditLog({
        userId, companyId, storeId: sourceStoreId,
        action: "PRODUCT_RELOCATED",
        entityType: "product",
        entityId: source.id,
        metadata: { productName: source.name, quantity: movedQuantity, targetStoreId, targetStoreName: targetStore.name },
      });

      return res.json({ message: "Product relocated", product: result });
    }

    if (mode === "CLONE") {
      const qty = Number(quantity);
      if (!qty || qty <= 0) {
        return res.status(400).json({ message: "Quantity is required for this transfer mode" });
      }
      if (qty > (source.stockQuantity || 0)) {
        return res.status(400).json({ message: "Insufficient stock to transfer that quantity" });
      }

      const familyId = source.linkedFamilyId || source.id;

      const result = await prisma.$transaction(async (tx) => {
        if (!source.linkedFamilyId) {
          await tx.product.update({ where: { id: source.id }, data: { linkedFamilyId: familyId } });
        }

        const updatedSource = await tx.product.update({
          where: { id: source.id },
          data: { stockQuantity: { decrement: qty } },
        });

        let twin = await tx.product.findFirst({
          where: { companyId, storeId: targetStoreId, linkedFamilyId: familyId },
        });

        if (twin) {
          twin = await tx.product.update({
            where: { id: twin.id },
            data: { stockQuantity: { increment: qty } },
          });
        } else {
          let sku = `${source.sku}-${targetStore.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`;
          let attempt = 0;
          while (await tx.product.findFirst({ where: { companyId, sku } })) {
            attempt++;
            sku = `${source.sku}-${targetStore.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}${attempt}`;
          }

          twin = await tx.product.create({
            data: {
              companyId, storeId: targetStoreId,
              name: source.name, sku,
              barcode: source.barcode,
              buyingPrice: source.buyingPrice,
              sellingPrice: source.sellingPrice,
              unitType: source.unitType,
              stockQuantity: qty,
              linkedFamilyId: familyId,
            },
          });
        }

        await tx.inventoryMovement.create({
          data: {
            companyId, storeId: sourceStoreId, productId: source.id,
            createdById: userId, type: "TRANSFER_OUT", quantity: qty,
            reason: reason || `Transferred to ${targetStore.name}`,
            sourceStoreId, targetStoreId,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId, storeId: targetStoreId, productId: twin.id,
            createdById: userId, type: "TRANSFER_IN", quantity: qty,
            reason: reason || `Transferred from source store`,
            sourceStoreId, targetStoreId,
          },
        });

        return { updatedSource, twin };
      });

      await createAuditLog({
        userId, companyId, storeId: sourceStoreId,
        action: "INVENTORY_TRANSFERRED",
        entityType: "product",
        entityId: source.id,
        metadata: {
          productName: source.name, quantity: qty,
          targetStoreId, targetStoreName: targetStore.name,
          twinProductId: result.twin.id,
        },
      });

      return res.json({ message: "Stock transferred", ...result });
    }

    return res.status(400).json({ message: "Invalid transfer mode" });
  } catch (error) {
    console.error("TRANSFER STOCK ERROR:", error);
    res.status(500).json({ message: "Failed to transfer stock" });
  }
};