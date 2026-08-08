import prisma from "../lib/prisma.js";
import { getSubscriptionStatus } from "../services/subscriptionService.js";

// GET /api/subscription/status
export const getStatus = async (req, res) => {
  try {
    const result = await getSubscriptionStatus(req.context.companyId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch subscription status" });
  }
};

// POST /api/subscription/payments
// Shop submits proof of payment (mobile money / bank ref) for manual verification.
export const submitPayment = async (req, res) => {
  try {
    const { amount, method, referenceNumber, notes } = req.body;
    const { companyId, userId } = req.context;

    if (!amount || !method || !referenceNumber) {
      return res.status(400).json({ message: "Amount, method, and reference number are required" });
    }

    const subscription = await prisma.subscription.findUnique({ where: { companyId } });

    if (!subscription) {
      return res.status(404).json({ message: "No subscription found for this company" });
    }

    const payment = await prisma.payment.create({
      data: {
        companyId,
        subscriptionId: subscription.id,
        amount: Number(amount),
        method,
        referenceNumber,
        notes,
        submittedById: userId,
      },
    });

    res.status(201).json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit payment" });
  }
};

// GET /api/subscription/payments — this company's own payment history
export const getPaymentHistory = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { companyId: req.context.companyId },
      orderBy: { createdAt: "desc" },
    });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
};