import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";
import { sendEmail } from "../utils/mailer.js";

// GET /api/purchase-orders
export const getPurchaseOrders = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { status, supplierId } = req.query;

    const where = { companyId, storeId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const withTotals = orders.map((o) => ({
      ...o,
      total: o.items.reduce((sum, i) => sum + i.unitCost * i.quantityOrdered, 0),
    }));

    res.json(withTotals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase orders" });
  }
};

// GET /api/purchase-orders/:id
export const getPurchaseOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId } = req.context;

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, companyId, storeId },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
    });

    if (!order) return res.status(404).json({ message: "Purchase order not found" });

    const total = order.items.reduce((sum, i) => sum + i.unitCost * i.quantityOrdered, 0);

    res.json({ ...order, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch purchase order" });
  }
};

// POST /api/purchase-orders
// body: { supplierId, notes, items: [{ productId, quantityOrdered, unitCost }] }
export const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, notes, items } = req.body;
    const { companyId, storeId, userId } = req.context;

    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Supplier and at least one item are required" });
    }

    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const order = await prisma.purchaseOrder.create({
      data: {
        companyId,
        storeId,
        supplierId,
        createdById: userId,
        notes,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantityOrdered: Number(i.quantityOrdered),
            unitCost: Number(i.unitCost),
          })),
        },
      },
      include: { items: { include: { product: true } }, supplier: true },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PURCHASE_ORDER_CREATED",
      entityType: "purchase_order",
      entityId: order.id,
      metadata: { supplierName: supplier.name, itemCount: items.length },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create purchase order" });
  }
};

// POST /api/purchase-orders/:id/send — emails the supplier, marks SENT
export const sendPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId, userId } = req.context;

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, companyId, storeId },
      include: { supplier: true, items: { include: { product: true } } },
    });

    if (!order) return res.status(404).json({ message: "Purchase order not found" });
    if (order.status !== "DRAFT") {
      return res.status(400).json({ message: `Order is already ${order.status}` });
    }

    let emailResult = { sent: false, reason: "NO_SUPPLIER_EMAIL" };

    if (order.supplier.email) {
      const rows = order.items
        .map(
          (i) =>
            `<tr><td>${i.product.name}</td><td>${i.quantityOrdered}</td><td>UGX ${i.unitCost.toLocaleString()}</td></tr>`
        )
        .join("");

      emailResult = await sendEmail({
        to: order.supplier.email,
        subject: `Purchase Order from your customer`,
        html: `
          <p>Hello ${order.supplier.name},</p>
          <p>We'd like to place the following order:</p>
          <table border="1" cellpadding="8" style="border-collapse:collapse">
            <tr><th>Item</th><th>Quantity</th><th>Unit Cost</th></tr>
            ${rows}
          </table>
          ${order.notes ? `<p>Notes: ${order.notes}</p>` : ""}
          <p>Please confirm availability and delivery timing.</p>
        `,
      });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PURCHASE_ORDER_SENT",
      entityType: "purchase_order",
      entityId: id,
      metadata: { supplierName: order.supplier.name, emailSent: emailResult.sent, reason: emailResult.reason },
    });

    res.json({ order: updated, email: emailResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send purchase order" });
  }
};

// POST /api/purchase-orders/:id/receive
// body: { items: [{ itemId, quantityReceived }] }
// Applies real stock increases, inventory movements, and supplier debt —
// this is the moment a PO stops being paperwork and becomes real inventory.
export const receivePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items: receivedItems } = req.body;
    const { companyId, storeId, userId } = req.context;

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, companyId, storeId },
      include: { items: true, supplier: true },
    });

    if (!order) return res.status(404).json({ message: "Purchase order not found" });
    if (order.status === "RECEIVED") {
      return res.status(400).json({ message: "This order was already received" });
    }
    if (order.status === "CANCELLED") {
      return res.status(400).json({ message: "This order was cancelled" });
    }

    const receivedMap = new Map((receivedItems || []).map((i) => [i.itemId, Number(i.quantityReceived)]));

    let orderTotal = 0;

    const result = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const qty = receivedMap.has(item.id) ? receivedMap.get(item.id) : item.quantityOrdered;

        if (qty > 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: qty } },
          });

          await tx.inventoryMovement.create({
            data: {
              companyId, storeId, productId: item.productId,
              createdById: userId, type: "IN", quantity: qty,
              reason: `Received PO ${order.id.slice(0, 8)} from ${order.supplier.name}`,
            },
          });
        }

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { quantityReceived: qty },
        });

        orderTotal += qty * item.unitCost;
      }

      const updatedSupplier = await tx.supplier.update({
        where: { id: order.supplierId },
        data: { totalOwed: { increment: orderTotal } },
      });

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });

      return { updatedSupplier, updatedOrder };
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PURCHASE_ORDER_RECEIVED",
      entityType: "purchase_order",
      entityId: id,
      metadata: { supplierName: order.supplier.name, orderTotal },
    });

    res.json({ message: "Order received, stock updated", ...result, orderTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to receive purchase order" });
  }
};

// POST /api/purchase-orders/cancel/:id
export const cancelPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId, userId } = req.context;

    const order = await prisma.purchaseOrder.findFirst({ where: { id, companyId, storeId } });
    if (!order) return res.status(404).json({ message: "Purchase order not found" });
    if (order.status === "RECEIVED") {
      return res.status(400).json({ message: "Cannot cancel an already-received order" });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PURCHASE_ORDER_CANCELLED",
      entityType: "purchase_order",
      entityId: id,
      metadata: {},
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to cancel purchase order" });
  }
};