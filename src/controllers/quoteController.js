import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";
import { sendEmail } from "../utils/mailer.js";

const VAT_RATE = 0.18;

// CREATE QUOTE — a pro-forma, no stock touched, no fiscal receipt
export const createQuote = async (req, res) => {
  try {
    const { customerId, items, notes, validUntil } = req.body;
    const { companyId, storeId, userId } = req.context;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId, storeId },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const quoteItems = items.map((i) => {
      const product = productMap.get(i.productId);
      if (!product) throw new Error(`Product not found`);
      const lineSubtotal = product.sellingPrice * Number(i.quantity);
      subtotal += lineSubtotal;
      return {
        productId: i.productId,
        quantity: Number(i.quantity),
        unitPrice: product.sellingPrice,
        subtotal: lineSubtotal,
      };
    });

    const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
    const totalAmount = subtotal + vatAmount;

    const quote = await prisma.quote.create({
      data: {
        companyId, storeId, userId, customerId,
        subtotal, vatAmount, totalAmount,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        items: { create: quoteItems },
      },
      include: { items: { include: { product: true } }, customer: true },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "QUOTE_CREATED",
      entityType: "quote",
      entityId: quote.id,
      metadata: { totalAmount, itemCount: items.length },
    });

    res.status(201).json(quote);
  } catch (err) {
    console.error("CREATE QUOTE ERROR:", err);
    res.status(500).json({ message: err.message || "Failed to create quote" });
  }
};

// GET QUOTES
export const getQuotes = async (req, res) => {
  try {
    const { companyId, storeId } = req.context;
    const { status } = req.query;

    const where = { companyId, storeId };
    if (status) where.status = status;

    const quotes = await prisma.quote.findMany({
      where,
      include: { customer: true, user: { select: { name: true } }, items: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(quotes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET ONE QUOTE
export const getQuoteDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId } = req.context;

    const quote = await prisma.quote.findFirst({
      where: { id, companyId, storeId },
      include: {
        customer: true,
        user: { select: { name: true } },
        items: { include: { product: true } },
      },
    });

    if (!quote) return res.status(404).json({ message: "Quote not found" });
    res.json(quote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// UPDATE QUOTE ITEMS — while still DRAFT/SENT, before conversion
export const updateQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, items, notes, validUntil } = req.body;
    const { companyId, storeId, userId } = req.context;

    const existing = await prisma.quote.findFirst({ where: { id, companyId, storeId } });
    if (!existing) return res.status(404).json({ message: "Quote not found" });
    if (["CONVERTED", "CANCELLED"].includes(existing.status)) {
      return res.status(400).json({ message: `This quote is already ${existing.status.toLowerCase()}` });
    }

    let updateData = { customerId, notes, validUntil: validUntil ? new Date(validUntil) : null };

    if (Array.isArray(items) && items.length > 0) {
      const productIds = items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, companyId, storeId },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const quoteItems = items.map((i) => {
        const product = productMap.get(i.productId);
        const lineSubtotal = product.sellingPrice * Number(i.quantity);
        subtotal += lineSubtotal;
        return {
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: product.sellingPrice,
          subtotal: lineSubtotal,
        };
      });

      const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;

      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      updateData = {
        ...updateData,
        subtotal,
        vatAmount,
        totalAmount: subtotal + vatAmount,
        items: { create: quoteItems },
      };
    }

    const updated = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: { items: { include: { product: true } }, customer: true },
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "QUOTE_UPDATED",
      entityType: "quote",
      entityId: id,
      metadata: { totalAmount: updated.totalAmount },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// SEND QUOTE — marks SENT, emails the customer if they have an email on file
export const sendQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId, userId } = req.context;

    const quote = await prisma.quote.findFirst({
      where: { id, companyId, storeId },
      include: { items: { include: { product: true } }, customer: true },
    });

    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (quote.status !== "DRAFT") {
      return res.status(400).json({ message: `Quote is already ${quote.status}` });
    }

    let emailResult = { sent: false, reason: "NO_CUSTOMER_EMAIL" };

    if (quote.customer?.email) {
      const rows = quote.items
        .map((i) => `<tr><td>${i.product.name}</td><td>${i.quantity}</td><td>UGX ${i.unitPrice.toLocaleString()}</td></tr>`)
        .join("");

      emailResult = await sendEmail({
        to: quote.customer.email,
        subject: "Your Quotation",
        html: `
          <p>Hello ${quote.customer.name},</p>
          <p>Here is the quotation you requested:</p>
          <table border="1" cellpadding="8" style="border-collapse:collapse">
            <tr><th>Item</th><th>Qty</th><th>Unit Price</th></tr>
            ${rows}
          </table>
          <p>Subtotal: UGX ${quote.subtotal.toLocaleString()}<br/>
          VAT (18%): UGX ${quote.vatAmount.toLocaleString()}<br/>
          <strong>Total: UGX ${quote.totalAmount.toLocaleString()}</strong></p>
          ${quote.notes ? `<p>Notes: ${quote.notes}</p>` : ""}
        `,
      });
    }

    const updated = await prisma.quote.update({ where: { id }, data: { status: "SENT" } });

    await createAuditLog({
      userId, companyId, storeId,
      action: "QUOTE_SENT",
      entityType: "quote",
      entityId: id,
      metadata: { emailSent: emailResult.sent, reason: emailResult.reason },
    });

    res.json({ quote: updated, email: emailResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// CANCEL QUOTE
export const cancelQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, storeId, userId } = req.context;

    const quote = await prisma.quote.findFirst({ where: { id, companyId, storeId } });
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (quote.status === "CONVERTED") {
      return res.status(400).json({ message: "This quote has already been converted to a sale" });
    }

    const updated = await prisma.quote.update({ where: { id }, data: { status: "CANCELLED" } });

    await createAuditLog({
      userId, companyId, storeId,
      action: "QUOTE_CANCELLED",
      entityType: "quote",
      entityId: id,
      metadata: {},
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// CONVERT QUOTE TO REAL SALE
// The quote's locked-in prices are honored even if list prices have since
// changed — that's the whole point of having quoted them. Stock IS
// re-validated now, since time has passed and availability could have
// changed since the quote was created.
export const convertQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod = "CASH", payments = null, clientReferenceId = null } = req.body;
    const { companyId, storeId, userId } = req.context;

    const quote = await prisma.quote.findFirst({
      where: { id, companyId, storeId },
      include: { items: { include: { product: true } }, customer: true },
    });

    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (quote.status === "CONVERTED") {
      return res.status(400).json({ message: "This quote has already been converted" });
    }
    if (quote.status === "CANCELLED") {
      return res.status(400).json({ message: "This quote was cancelled" });
    }

    // Re-validate stock at conversion time
    for (const item of quote.items) {
      const currentProduct = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!currentProduct || currentProduct.stockQuantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${item.product.name} — available: ${currentProduct?.stockQuantity ?? 0}, needed: ${item.quantity}`,
        });
      }
    }

    let splitEntries = null;
    if (payments && Array.isArray(payments) && payments.length > 0) {
      splitEntries = payments
        .map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference || null }))
        .filter((p) => p.amount > 0);

      const splitSum = splitEntries.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(splitSum - quote.totalAmount) > 1) {
        return res.status(400).json({
          message: `Payment lines total UGX ${splitSum.toLocaleString()}, but the quote total is UGX ${quote.totalAmount.toLocaleString()}`,
        });
      }
    }

    const creditPortion = splitEntries
      ? splitEntries.filter((p) => p.method === "CREDIT").reduce((sum, p) => sum + p.amount, 0)
      : (paymentMethod === "CREDIT" ? quote.totalAmount : 0);

    if (creditPortion > 0) {
      if (!quote.customerId) {
        return res.status(400).json({ message: "A customer is required for the credit portion of this sale" });
      }
      if (quote.customer.creditLimit > 0) {
        const projected = quote.customer.totalCredit + creditPortion;
        if (projected > quote.customer.creditLimit) {
          return res.status(400).json({
            message: `This would put ${quote.customer.name} at UGX ${projected.toLocaleString()}, over their credit limit of UGX ${quote.customer.creditLimit.toLocaleString()}.`,
          });
        }
      }
    }

    const distinctMethods = splitEntries ? new Set(splitEntries.map((p) => p.method)) : null;
    const storedPaymentMethod = splitEntries
      ? (distinctMethods.size > 1 ? "MIXED" : [...distinctMethods][0])
      : paymentMethod;

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          companyId, storeId, userId,
          totalAmount: quote.totalAmount,
          subtotal: quote.subtotal,
          vatAmount: quote.vatAmount,
          discount: 0,
          paymentMethod: storedPaymentMethod,
          customerId: quote.customerId,
          clientReferenceId,
          fiscalReceiptId: `NOVA-EFRIS-${Date.now()}`,
          qrCodeData: `https://efris.ura.go.ug/verify?receiptId=NOVA-EFRIS-${Date.now()}`,
        },
      });

      const saleItems = [];
      const movements = [];

      for (const item of quote.items) {
        saleItems.push({
          saleId: newSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        });

        movements.push({
          companyId, storeId, productId: item.productId,
          createdById: userId, type: "SALE", quantity: item.quantity,
          reason: `Converted from quote ${quote.id.slice(0, 8)}`,
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      await tx.saleItem.createMany({ data: saleItems });
      await tx.inventoryMovement.createMany({ data: movements });

      const paymentLines = splitEntries || [{ method: paymentMethod, amount: quote.totalAmount, reference: null }];
      await tx.salePayment.createMany({
        data: paymentLines.map((p) => ({
          saleId: newSale.id, method: p.method, amount: p.amount, reference: p.reference,
        })),
      });

      if (creditPortion > 0 && quote.customerId) {
        await tx.customer.update({
          where: { id: quote.customerId },
          data: { totalCredit: { increment: creditPortion } },
        });
      }

      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "CONVERTED", convertedSaleId: newSale.id },
      });

      return newSale;
    });

    await createAuditLog({
      userId, companyId, storeId,
      action: "QUOTE_CONVERTED",
      entityType: "quote",
      entityId: quote.id,
      metadata: { saleId: sale.id, totalAmount: quote.totalAmount },
    });

    res.status(201).json(sale);
  } catch (err) {
    console.error("CONVERT QUOTE ERROR:", err);
    res.status(500).json({ message: "Failed to convert quote to sale" });
  }
};