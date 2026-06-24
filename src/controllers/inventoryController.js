import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET all inventory movements
export const getMovements = async (req, res) => {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      include: {
        product: true,
        createdBy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(movements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const adjustStock = async (req, res) => {
  try {
    const { productId, quantity, type, reason } = req.body;

    const userId = req.user?.id || null; // if auth exists

    const qty = Number(quantity);

    // 1. Create movement record
    const movement = await prisma.inventoryMovement.create({
      data: {
        productId,
        quantity: qty,
        type,
        reason,
        createdById: userId,
      },
    });

    // 2. Update product stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let newStock = product.stockQuantity || 0;

    if (type === "IN") {
      newStock += qty;
    } else if (type === "OUT") {
      newStock -= qty;
    }

    if (newStock < 0) newStock = 0;

    await prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: newStock,
      },
    });

    res.json({
      message: "Stock updated successfully",
      movement,
      newStock,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};