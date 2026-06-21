import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

export const createSale = async (req, res) => {
  try {
    const { items, paymentMethod = "CASH", discount = 0 } = req.body;
    const io = req.app.get("io");

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Cart cannot be empty" });
    }

    const productIds = items.map(i => i.productId);

    // Fetch products with store isolation
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId: req.user.storeId,
      },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    // Validate stock
    for (let item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product not found` });
      }
      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}` 
        });
      }
    }

    // Calculate total
    let totalAmount = 0;
    for (let item of items) {
      const product = productMap.get(item.productId);
      totalAmount += product.sellingPrice * item.quantity;
    }
    totalAmount = Math.max(0, totalAmount - discount);

    // Atomic Transaction
    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          storeId: req.user.storeId,
          userId: req.user.id,
          totalAmount,
          discount,
          paymentMethod,
        },
      });

      const saleItemsData = [];
      const movementData = [];

      for (let item of items) {
        const product = productMap.get(item.productId);
        const subtotal = product.sellingPrice * item.quantity;

        saleItemsData.push({
          saleId: newSale.id,
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          subtotal,
        });

        movementData.push({
          productId: product.id,
          type: "SALE",
          quantity: item.quantity,
          createdById: req.user.id,
        });

        // Update stock
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      await tx.saleItem.createMany({ data: saleItemsData });
      await tx.inventoryMovement.createMany({ data: movementData });

      return newSale;
    });

    // Audit Log
    await createAuditLog({
      userId: req.user.id,
      action: "SALE_CREATED",
      entityType: "sale",
      entityId: sale.id,
      metadata: { totalAmount, itemCount: items.length },
    });

    // Real-time update
    io.emit("sale:completed", { storeId: req.user.storeId });

    res.status(201).json(sale);
  } catch (error) {
    console.error("Sale Error:", error);
    res.status(500).json({ message: "Failed to complete sale" });
  }
};

export const getSales = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      where: { storeId: req.user.storeId },
      include: {
        user: { select: { name: true, role: true } },
        saleItems: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sales" });
  }
};