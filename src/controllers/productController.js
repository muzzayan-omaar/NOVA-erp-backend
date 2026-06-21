import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

export const createProduct = async (req, res) => {
  try {
    const { name, barcode, sku, buyingPrice, sellingPrice, stockQuantity = 0, unitType = "pcs" } = req.body;

    if (!name || !sellingPrice) {
      return res.status(400).json({ message: "Product name and selling price are required" });
    }

    const product = await prisma.product.create({
      data: {
        name,
        barcode,
        sku,
        buyingPrice: parseFloat(buyingPrice || 0),
        sellingPrice: parseFloat(sellingPrice),
        stockQuantity: parseFloat(stockQuantity),
        unitType,
        storeId: req.user.storeId,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      metadata: product,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create product" });
  }
};

export const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { storeId: req.user.storeId },
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products" });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.update({
      where: { id, storeId: req.user.storeId },
      data: req.body,
    });

    await createAuditLog({
      userId: req.user.id,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: id,
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Failed to update product" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({
      where: { id, storeId: req.user.storeId },
    });

    await createAuditLog({
      userId: req.user.id,
      action: "PRODUCT_DELETED",
      entityType: "product",
      entityId: id,
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product" });
  }
};

export const getLowStock = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { 
        storeId: req.user.storeId,
        stockQuantity: { lte: 10 }
      },
      orderBy: { stockQuantity: "asc" }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch low stock" });
  }
};