import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

import {
  createNotification
} from "../modules/notifications/notification.service.js";

import {
  generateLowStockNotifications
} from "../modules/notifications/notification.generator.js";

/**
 * CREATE SALE
 */
export const createSale = async (req, res) => {
  try {
    const {
      items,
      paymentMethod = "CASH",
      discount = 0
    } = req.body;

    const io = req.app.get("io");

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Cart cannot be empty"
      });
    }

    const productIds = items.map((item) => item.productId);

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds
        },
        companyId: req.context.companyId,
        storeId: req.context.storeId
      }
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return res.status(404).json({
          message: "Product not found"
        });
      }

      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}`
        });
      }

      subtotal += product.sellingPrice * item.quantity;
    }

    // Uganda VAT
    const vatRate = 0.18;

    const vatAmount = Math.round(subtotal * vatRate * 100) / 100;

    const totalAmount = subtotal + vatAmount - Number(discount);

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          companyId: req.context.companyId,
          storeId: req.context.storeId,
          userId: req.context.userId,
          totalAmount,
          subtotal,
          vatAmount,
          discount: Number(discount),
          paymentMethod,
          fiscalReceiptId: `NOVA-EFRIS-${Date.now()}`,
          qrCodeData: `https://efris.ura.go.ug/verify?receiptId=NOVA-EFRIS-${Date.now()}`
        }
      });

      const saleItems = [];
      const movements = [];

      for (const item of items) {
        const product = productMap.get(item.productId);

        const itemSubtotal = product.sellingPrice * item.quantity;

        saleItems.push({
          saleId: newSale.id,
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          subtotal: itemSubtotal
        });

        movements.push({
          companyId: req.context.companyId,
          storeId: req.context.storeId,
          productId: product.id,
          createdById: req.context.userId,
          type: "SALE",
          quantity: item.quantity,
          reason: "Sale transaction"
        });

        await tx.product.update({
          where: {
            id: product.id
          },
          data: {
            stockQuantity: {
              decrement: item.quantity
            }
          }
        });
      }

      await tx.saleItem.createMany({
        data: saleItems
      });

      await tx.inventoryMovement.createMany({
        data: movements
      });

      return newSale;
    });

    await createAuditLog({
      userId: req.context.userId,
      action: "SALE_CREATED",
      entityType: "sale",
      entityId: sale.id,
      metadata: {
        totalAmount,
        vatAmount,
        subtotal,
        itemCount: items.length
      }
    });

    // Notifications (after sale + stock update succeed)
    try {
      await createNotification({
        companyId: req.context.companyId,
        storeId: req.context.storeId,
        userId: req.context.userId,
        title: "Sale Completed",
        message: `Sale completed successfully. Amount: ${totalAmount}`,
        type: "SALE",
        priority: "LOW",
        uniqueKey: `SALE_${sale.id}`,
        metadata: {
          saleId: sale.id,
          amount: totalAmount,
          paymentMethod,
          items: items.length
        }
      });

      await generateLowStockNotifications(req.context.companyId);
    } catch (notifyErr) {
      console.error("Notification error:", notifyErr);
      // Don't fail the sale if notifications fail
    }

    if (io) {
      io.emit("sale:completed", {
        storeId: req.context.storeId
      });
    }

    res.status(201).json(sale);
  } catch (error) {
    console.error("SALE ERROR:", error);

    res.status(500).json({
      message: "Failed to complete sale"
    });
  }
};

/**
 * GET SALES
 */
export const getSales = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      where: {
        companyId: req.context.companyId,
        storeId: req.context.storeId
      },
      include: {
        user: {
          select: {
            name: true,
            role: true
          }
        },
        saleItems: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json(sales);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch sales"
    });
  }
};

/**
 * TODAY STATS
 */
export const getTodayStats = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: {
        companyId: req.context.companyId,
        storeId: req.context.storeId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        totalAmount: true
      }
    });

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      totalSales,
      transactions: sales.length
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch today stats"
    });
  }
};