import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

/**
 * CREATE PRODUCT
 */
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      barcode,
      sku,
      buyingPrice,
      sellingPrice,
      stockQuantity = 0,
      unitType = "pcs",
      isSerialized = false,
    } = req.body;

    if (!name || !sellingPrice) {
      return res.status(400).json({
        message: "Product name and selling price are required",
      });
    }

    const product = await prisma.product.create({
      data: {
        companyId: req.context.companyId,
        storeId: req.context.storeId,

        name,
        barcode,
        sku,
        buyingPrice: parseFloat(buyingPrice || 0),
        sellingPrice: parseFloat(sellingPrice),
        stockQuantity: parseFloat(stockQuantity),
        unitType,
        isSerialized: Boolean(isSerialized),
      },
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId: req.context.companyId,
      storeId: req.context.storeId,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      metadata: product,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to create product",
    });
  }
};

/**
 * GET PRODUCTS
 */
/**
 * GET PRODUCTS
 */
export const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
      include: {
        _count: {
          select: {
            units: { where: { isActive: true } },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const shaped = products.map((p) => ({
      ...p,
      hasUnits: p._count.units > 0,
    }));

    res.json(shaped);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch products",
    });
  }
};

/**
 * UPDATE PRODUCT
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const {
      name,
      barcode,
      sku,
      buyingPrice,
      sellingPrice,
      stockQuantity,
      unitType,
      isActive,
      isSerialized,
    } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(barcode !== undefined && { barcode }),
        ...(sku !== undefined && { sku }),
        ...(buyingPrice !== undefined && {
          buyingPrice: parseFloat(buyingPrice),
        }),
        ...(sellingPrice !== undefined && {
          sellingPrice: parseFloat(sellingPrice),
        }),
        ...(stockQuantity !== undefined && {
          stockQuantity: parseFloat(stockQuantity),
        }),
        ...(unitType !== undefined && { unitType }),
        ...(isActive !== undefined && { isActive }),
        ...(isSerialized !== undefined && { isSerialized: Boolean(isSerialized) }),
      },
    });

    // Before/after diff — specifically so a price change (the exact fraud
    // pattern a dishonest manager could exploit) is immediately visible in
    // the Audit Log without a GM having to cross-reference anything.
    const changes = {};
    if (buyingPrice !== undefined && existingProduct.buyingPrice !== product.buyingPrice) {
      changes.buyingPrice = { from: existingProduct.buyingPrice, to: product.buyingPrice };
    }
    if (sellingPrice !== undefined && existingProduct.sellingPrice !== product.sellingPrice) {
      changes.sellingPrice = { from: existingProduct.sellingPrice, to: product.sellingPrice };
    }
    if (stockQuantity !== undefined && existingProduct.stockQuantity !== product.stockQuantity) {
      changes.stockQuantity = { from: existingProduct.stockQuantity, to: product.stockQuantity };
    }
    if (name !== undefined && existingProduct.name !== product.name) {
      changes.name = { from: existingProduct.name, to: product.name };
    }
    if (isSerialized !== undefined && existingProduct.isSerialized !== product.isSerialized) {
      changes.isSerialized = { from: existingProduct.isSerialized, to: product.isSerialized };
    }

    await createAuditLog({
      userId: req.context.userId,
      companyId: req.context.companyId,
      storeId: req.context.storeId,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: id,
      metadata: {
        productName: product.name,
        changes,
      },
    });

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update product" });
  }
};

/**
 * DELETE PRODUCT
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    await prisma.product.delete({
      where: {
        id,
      },
    });

    await createAuditLog({
      userId: req.context.userId,
      action: "PRODUCT_DELETED",
      entityType: "product",
      entityId: id,
    });

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to delete product",
    });
  }
};

/**
 * LOW STOCK PRODUCTS
 */
export const getLowStock = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        companyId: req.context.companyId,
        storeId: req.context.storeId,
        stockQuantity: {
          lte: 10,
        },
      },
      orderBy: {
        stockQuantity: "asc",
      },
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch low stock",
    });
  }
};

// GET /api/products/resolve-scan?code=XXXX
// Checks serial → unit barcode → base barcode, in that priority order —
// a serial number is the most specific thing a scan could mean.
export const resolveScan = async (req, res) => {
  try {
    const { code } = req.query;
    const { companyId, storeId } = req.context;

    if (!code) return res.status(400).json({ message: "No code provided" });

    const serial = await prisma.productSerial.findFirst({
      where: { companyId, storeId, serialNumber: code, status: "IN_STOCK" },
      include: { product: true },
    });
    if (serial) {
      return res.json({ type: "SERIAL", product: serial.product, productUnit: null, serial });
    }

    const unit = await prisma.productUnit.findFirst({
      where: { companyId, barcode: code, isActive: true },
      include: { product: true },
    });
    if (unit && unit.product.storeId === storeId) {
      return res.json({ type: "UNIT", product: unit.product, productUnit: unit, serial: null });
    }

    const product = await prisma.product.findFirst({
      where: { companyId, storeId, barcode: code, isActive: true },
    });
    if (product) {
      return res.json({ type: "BASE", product, productUnit: null, serial: null });
    }

    return res.status(404).json({ message: "No product, unit, or serial matches this code" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};