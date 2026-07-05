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
      },
    });

    await createAuditLog({
      userId: req.context.userId,
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
export const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
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

    const product = await prisma.product.update({
      where: {
        id,
      },
      data: req.body,
    });

    await createAuditLog({
      userId: req.context.userId,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: id,
      metadata: product,
    });

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update product",
    });
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