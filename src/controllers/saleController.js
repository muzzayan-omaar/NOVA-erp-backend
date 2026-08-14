import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";
import bcrypt from "bcryptjs";

import { createNotification } from "../modules/notifications/notification.service.js";

import { generateLowStockNotifications } from "../modules/notifications/notification.generator.js";

/**
 * CREATE SALE
 */
export const createSale = async (req, res) => {
  try {
    const {
      items,
      paymentMethod = "CASH",
      discount = 0,
      clientReferenceId = null,
      clientCreatedAt = null,
    } = req.body;

    const io = req.app.get("io");

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Cart cannot be empty",
      });
    }

    // Idempotency check — if this exact client-generated sale was already
    // created (e.g. an offline queue retrying after the original request's
    // response got lost), return the existing sale instead of duplicating it.
    if (clientReferenceId) {
      const existing = await prisma.sale.findFirst({
        where: {
          companyId: req.context.companyId,
          clientReferenceId,
        },
        include: { saleItems: true },
      });

      if (existing) {
        return res.status(200).json(existing);
      }
    }

    const productIds = items.map((item) => item.productId);

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}`,
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
          clientReferenceId,
          clientCreatedAt: clientCreatedAt ? new Date(clientCreatedAt) : null,
          fiscalReceiptId: `NOVA-EFRIS-${Date.now()}`,
          qrCodeData: `https://efris.ura.go.ug/verify?receiptId=NOVA-EFRIS-${Date.now()}`,
        },
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
          subtotal: itemSubtotal,
        });

        movements.push({
          companyId: req.context.companyId,
          storeId: req.context.storeId,
          productId: product.id,
          createdById: req.context.userId,
          type: "SALE",
          quantity: item.quantity,
          reason: "Sale transaction",
        });

        await tx.product.update({
          where: {
            id: product.id,
          },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      await tx.saleItem.createMany({
        data: saleItems,
      });

      await tx.inventoryMovement.createMany({
        data: movements,
      });

      return newSale;
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId: req.context.companyId,
      storeId: req.context.storeId,
      action: "SALE_CREATED",
      entityType: "sale",
      entityId: sale.id,
      metadata: {
        totalAmount,
        vatAmount,
        subtotal,
        itemCount: items.length,
        clientCreatedAt,
        syncedLate: clientCreatedAt ? new Date() - new Date(clientCreatedAt) > 60000 : false,
      },
    });

    // Only check for low stock — the receipt itself already confirms
    // the sale happened, no need for a redundant notification per sale.
    try {
      await generateLowStockNotifications(req.context.companyId);
    } catch (notifyErr) {
      console.error("Notification error:", notifyErr);
      // Don't fail the sale if notifications fail
    }

    if (io) {
      io.emit("sale:completed", {
        storeId: req.context.storeId,
      });
    }

    res.status(201).json(sale);
  } catch (error) {
    console.error("CREATE SALE ERROR:", error);
    res.status(500).json({ message: "Failed to create sale" });
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
        storeId: req.context.storeId,
      },
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
        saleItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(sales);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch sales",
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
          lte: end,
        },
      },
      select: {
        totalAmount: true,
      },
    });

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      totalSales,
      transactions: sales.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch today stats",
    });
  }
};

/**
 * REQUEST VOID or REFUND
 * Called by the cashier. No manager credentials needed.
 * Freezes the sale as PENDING_VOID / PENDING_REFUND, does NOT touch stock yet.
 * POST /api/sales/:id/request-void
 * POST /api/sales/:id/request-refund
 * body: { reason }
 */
const requestSaleAction = (targetStatus, notifyTitle) => async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "A reason is required" });
    }

    const sale = await prisma.sale.findFirst({
      where: {
        id,
        companyId: req.context.companyId,
        storeId: req.context.storeId,
      },
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (sale.status !== "COMPLETED") {
      return res.status(400).json({ message: `Sale is already ${sale.status}` });
    }

    const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: targetStatus,
        requestedAt: new Date(),
        voidReason: reason,
        voidedById: req.context.userId,
      },
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId: req.context.companyId,
      storeId: req.context.storeId,
      action: targetStatus === "PENDING_VOID" ? "VOID_REQUESTED" : "REFUND_REQUESTED",
      entityType: "sale",
      entityId: sale.id,
      metadata: { reason, totalAmount: sale.totalAmount },
    });

    // Notify every General Manager in the company — not just one store.
    const generalManagers = await prisma.user.findMany({
      where: {
        companyId: req.context.companyId,
        role: "GENERAL_MANAGER",
        isActive: true,
      },
      select: { id: true },
    });

    await Promise.all(
      generalManagers.map((gm) =>
        createNotification({
          companyId: req.context.companyId,
          storeId: req.context.storeId,
          userId: gm.id,
          title: notifyTitle,
          message: `UGX ${Number(sale.totalAmount).toLocaleString()} sale — reason: ${reason}`,
          type: "APPROVAL_REQUEST",
          priority: "HIGH",
          uniqueKey: `${targetStatus}_${sale.id}`,
        })
      )
    );

    const io = req.app.get("io");
    if (io) {
      io.emit("sale:approval_requested", {
        storeId: req.context.storeId,
        saleId: sale.id,
        status: targetStatus,
      });
    }

    res.json(updatedSale);
  } catch (error) {
    console.error("REQUEST SALE ACTION ERROR:", error);
    res.status(500).json({ message: "Failed to submit request" });
  }
};

export const requestVoidSale = requestSaleAction("PENDING_VOID", "Void Request");
export const requestRefundSale = requestSaleAction("PENDING_REFUND", "Refund Request");

/**
 * GET PENDING REQUESTS — GM only.
 * Company-wide, not just the GM's currently active store.
 * GET /api/sales/pending-requests
 */
export const getPendingSaleRequests = async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      where: {
        companyId: req.context.companyId,
        status: { in: ["PENDING_VOID", "PENDING_REFUND"] },
      },
      include: {
        saleItems: { include: { product: true } },
        user: { select: { id: true, name: true, role: true } },
        voidedBy: { select: { id: true, name: true, role: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: "asc" },
    });

    res.json(sales);
  } catch (error) {
    console.error("GET PENDING REQUESTS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch pending requests" });
  }
};

/**
 * APPROVE a pending void/refund — GM only.
 * Reverses stock now, finalizes status.
 * POST /api/sales/:id/approve
 */
export const approveSaleAction = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: { id, companyId: req.context.companyId },
      include: { saleItems: true },
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (!["PENDING_VOID", "PENDING_REFUND"].includes(sale.status)) {
      return res.status(400).json({ message: "This sale has no pending request" });
    }

    const finalStatus = sale.status === "PENDING_VOID" ? "VOID" : "REFUNDED";

    const updatedSale = await prisma.$transaction(async (tx) => {
      for (const item of sale.saleItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId: sale.companyId,
            storeId: sale.storeId,
            productId: item.productId,
            createdById: req.context.userId,
            type: "IN",
            quantity: item.quantity,
            reason: `Sale ${finalStatus.toLowerCase()} (approved): ${sale.voidReason}`,
          },
        });
      }

      return tx.sale.update({
        where: { id: sale.id },
        data: {
          status: finalStatus,
          voidedAt: new Date(),
          authorizedById: req.context.userId,
        },
      });
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId: sale.companyId,
      storeId: sale.storeId,
      action: finalStatus === "VOID" ? "SALE_VOID_APPROVED" : "SALE_REFUND_APPROVED",
      entityType: "sale",
      entityId: sale.id,
      metadata: {
        reason: sale.voidReason,
        requestedBy: sale.voidedById,
        totalAmount: sale.totalAmount,
      },
    });

    if (sale.voidedById) {
      await createNotification({
        companyId: sale.companyId,
        storeId: sale.storeId,
        userId: sale.voidedById,
        title: `${finalStatus === "VOID" ? "Void" : "Refund"} Approved`,
        message: `Your request for UGX ${Number(sale.totalAmount).toLocaleString()} was approved.`,
        type: "APPROVAL_REQUEST",
        priority: "MEDIUM",
        uniqueKey: `APPROVED_${sale.id}`,
      });
    }

    res.json(updatedSale);
  } catch (error) {
    console.error("APPROVE SALE ACTION ERROR:", error);
    res.status(500).json({ message: "Failed to approve request" });
  }
};

/**
 * REJECT a pending void/refund — GM only.
 * Reverts sale back to COMPLETED, no stock change (nothing was ever reversed).
 * POST /api/sales/:id/reject
 * body: { rejectionReason }
 */
export const rejectSaleAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const sale = await prisma.sale.findFirst({
      where: { id, companyId: req.context.companyId },
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (!["PENDING_VOID", "PENDING_REFUND"].includes(sale.status)) {
      return res.status(400).json({ message: "This sale has no pending request" });
    }

    const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: "COMPLETED",
        rejectionReason: rejectionReason || null,
        authorizedById: req.context.userId,
      },
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId: sale.companyId,
      storeId: sale.storeId,
      action: "SALE_REQUEST_REJECTED",
      entityType: "sale",
      entityId: sale.id,
      metadata: { rejectionReason, originalReason: sale.voidReason },
    });

    if (sale.voidedById) {
      await createNotification({
        companyId: sale.companyId,
        storeId: sale.storeId,
        userId: sale.voidedById,
        title: "Request Rejected",
        message: `Your request for sale UGX ${Number(sale.totalAmount).toLocaleString()} was rejected.${rejectionReason ? " Reason: " + rejectionReason : ""}`,
        type: "APPROVAL_REQUEST",
        priority: "MEDIUM",
        uniqueKey: `REJECTED_${sale.id}`,
      });
    }

    res.json(updatedSale);
  } catch (error) {
    console.error("REJECT SALE ACTION ERROR:", error);
    res.status(500).json({ message: "Failed to reject request" });
  }
};
