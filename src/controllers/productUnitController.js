import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

// GET /api/products/:productId/units
export const getProductUnits = async (req, res) => {
  try {
    const { productId } = req.params;
    const { companyId, storeId } = req.context;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const units = await prisma.productUnit.findMany({
      where: { productId },
      orderBy: { conversionFactor: "asc" },
    });

    res.json(units);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/products/:productId/units
export const createProductUnit = async (req, res) => {
  try {
    const { productId } = req.params;
    const { unitName, conversionFactor, barcode, sellingPrice, buyingPrice } = req.body;
    const { companyId, storeId, userId } = req.context;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (!unitName || !conversionFactor || Number(conversionFactor) <= 0) {
      return res.status(400).json({ message: "Unit name and a positive conversion factor are required" });
    }

    if (barcode) {
      const existingBarcode = await prisma.productUnit.findFirst({ where: { companyId, barcode } });
      if (existingBarcode) {
        return res.status(400).json({ message: "This barcode is already used by another unit in your company" });
      }
    }

    const unit = await prisma.productUnit.create({
      data: {
        companyId,
        productId,
        unitName,
        conversionFactor: Number(conversionFactor),
        barcode: barcode || null,
        sellingPrice: sellingPrice ? Number(sellingPrice) : null,
        buyingPrice: buyingPrice ? Number(buyingPrice) : null,
      },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PRODUCT_UNIT_CREATED",
      entityType: "product_unit",
      entityId: unit.id,
      metadata: { productName: product.name, unitName, conversionFactor: Number(conversionFactor) },
    });

    res.status(201).json(unit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/products/:productId/units/:id
// Changing conversionFactor is safe — every past transaction already has
// its own locked-in snapshot, so this only affects future ones.
export const updateProductUnit = async (req, res) => {
  try {
    const { productId, id } = req.params;
    const { unitName, conversionFactor, barcode, sellingPrice, buyingPrice, isActive } = req.body;
    const { companyId, storeId, userId } = req.context;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const existing = await prisma.productUnit.findFirst({ where: { id, productId } });
    if (!existing) return res.status(404).json({ message: "Unit not found" });

    if (barcode && barcode !== existing.barcode) {
      const barcodeInUse = await prisma.productUnit.findFirst({ where: { companyId, barcode, id: { not: id } } });
      if (barcodeInUse) {
        return res.status(400).json({ message: "This barcode is already used by another unit in your company" });
      }
    }

    const updated = await prisma.productUnit.update({
      where: { id },
      data: {
        ...(unitName !== undefined && { unitName }),
        ...(conversionFactor !== undefined && { conversionFactor: Number(conversionFactor) }),
        ...(barcode !== undefined && { barcode: barcode || null }),
        ...(sellingPrice !== undefined && { sellingPrice: sellingPrice ? Number(sellingPrice) : null }),
        ...(buyingPrice !== undefined && { buyingPrice: buyingPrice ? Number(buyingPrice) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PRODUCT_UNIT_UPDATED",
      entityType: "product_unit",
      entityId: id,
      metadata: { productName: product.name },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/products/:productId/units/:id
// If this unit has ever been used in a real transaction, it's deactivated
// instead of deleted — deleting it would orphan historical line items.
export const deleteProductUnit = async (req, res) => {
  try {
    const { productId, id } = req.params;
    const { companyId, storeId, userId } = req.context;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const existing = await prisma.productUnit.findFirst({ where: { id, productId } });
    if (!existing) return res.status(404).json({ message: "Unit not found" });

    const usageCount = await prisma.saleItem.count({ where: { productUnitId: id } })
      + await prisma.quoteItem.count({ where: { productUnitId: id } })
      + await prisma.purchaseOrderItem.count({ where: { productUnitId: id } });

    if (usageCount > 0) {
      await prisma.productUnit.update({ where: { id }, data: { isActive: false } });
      return res.json({ message: "Unit has transaction history — deactivated instead of deleted" });
    }

    await prisma.productUnit.delete({ where: { id } });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PRODUCT_UNIT_DELETED",
      entityType: "product_unit",
      entityId: id,
      metadata: { productName: product.name, unitName: existing.unitName },
    });

    res.json({ message: "Unit deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};