import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

// GET /api/products/:productId/serials
export const getProductSerials = async (req, res) => {
  try {
    const { productId } = req.params;
    const { status } = req.query;
    const { companyId, storeId } = req.context;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const where = { productId, storeId };
    if (status) where.status = status;

    const serials = await prisma.productSerial.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(serials);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/products/:productId/serials
// body: { serialNumbers: ["SN001", "SN002", ...] } — bulk, since receiving
// 10 drills means entering 10 serials at once, not one at a time.
export const addProductSerials = async (req, res) => {
  try {
    const { productId } = req.params;
    const { serialNumbers } = req.body;
    const { companyId, storeId, userId } = req.context;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({ message: "Provide at least one serial number" });
    }

    const cleaned = [...new Set(serialNumbers.map((s) => s.trim()).filter(Boolean))];

    const existing = await prisma.productSerial.findMany({
      where: { companyId, serialNumber: { in: cleaned } },
      select: { serialNumber: true },
    });

    if (existing.length > 0) {
      return res.status(400).json({
        message: `These serial numbers already exist in your company: ${existing.map((e) => e.serialNumber).join(", ")}`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.productSerial.createMany({
        data: cleaned.map((serialNumber) => ({ companyId, productId, storeId, serialNumber })),
      });

      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: cleaned.length }, isSerialized: true },
      });
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PRODUCT_SERIALS_ADDED",
      entityType: "product",
      entityId: productId,
      metadata: { productName: product.name, count: cleaned.length },
    });

    res.status(201).json({ message: `${cleaned.length} serial(s) added`, count: cleaned.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/products/:productId/serials/:id
// Manual status override — e.g. marking one defective/returned.
export const updateProductSerialStatus = async (req, res) => {
  try {
    const { productId, id } = req.params;
    const { status } = req.body;
    const { companyId, storeId, userId } = req.context;

    const validStatuses = ["IN_STOCK", "IN_TRANSIT", "SOLD", "RETURNED_DEFECTIVE"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const serial = await prisma.productSerial.findFirst({ where: { id, productId } });
    if (!serial) return res.status(404).json({ message: "Serial not found" });

    if (serial.status === "SOLD" && status !== "SOLD") {
      return res.status(400).json({ message: "Cannot change the status of a serial that has already been sold" });
    }

    const wasInStock = serial.status === "IN_STOCK";
    const willBeInStock = status === "IN_STOCK";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.productSerial.update({ where: { id }, data: { status } });

      // Keep the product's stockQuantity honest if a unit moves in or out
      // of sellable stock (e.g. marking one defective removes it from stock).
      if (wasInStock && !willBeInStock) {
        await tx.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: 1 } } });
      } else if (!wasInStock && willBeInStock) {
        await tx.product.update({ where: { id: productId }, data: { stockQuantity: { increment: 1 } } });
      }

      return result;
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "PRODUCT_SERIAL_STATUS_CHANGED",
      entityType: "product_serial",
      entityId: id,
      metadata: { productName: product.name, serialNumber: serial.serialNumber, from: serial.status, to: status },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/products/:productId/serials/:id
// Only ever allowed for a serial that's still IN_STOCK and was never sold —
// deleting a sold serial would erase real transaction history.
export const deleteProductSerial = async (req, res) => {
  try {
    const { productId, id } = req.params;
    const { companyId, storeId, userId } = req.context;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId, storeId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const serial = await prisma.productSerial.findFirst({ where: { id, productId } });
    if (!serial) return res.status(404).json({ message: "Serial not found" });

    if (serial.status !== "IN_STOCK") {
      return res.status(400).json({ message: "Only an unsold, in-stock serial can be deleted" });
    }

    await prisma.$transaction([
      prisma.productSerial.delete({ where: { id } }),
      prisma.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: 1 } } }),
    ]);

    await createAuditLog({
      userId, companyId, storeId,
      action: "PRODUCT_SERIAL_DELETED",
      entityType: "product_serial",
      entityId: id,
      metadata: { productName: product.name, serialNumber: serial.serialNumber },
    });

    res.json({ message: "Serial deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};