import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";
import createPlatformAuditLog from "../services/platformAuditService.js";
import { createNotification } from "../modules/notifications/notification.service.js";

export const getPendingPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: "PENDING_VERIFICATION" },
      include: {
        company: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch pending payments" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { approve, plan } = req.body;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    if (!approve) {
      const rejected = await prisma.payment.update({
        where: { id },
        data: { status: "REJECTED", verifiedById: req.platformAdmin.id, verifiedAt: new Date() },
      });

      await createPlatformAuditLog({
        platformAdminId: req.platformAdmin.id,
        action: "PAYMENT_REJECTED",
        entityType: "payment",
        entityId: id,
        metadata: { companyId: payment.companyId, amount: payment.amount },
      });

      return res.json(rejected);
    }

    const planCode = plan || "BASIC";
    const planRecord = await prisma.plan.findUnique({ where: { code: planCode } });

    if (!planRecord || !planRecord.isActive) {
      return res.status(400).json({ message: `Plan "${planCode}" is not available` });
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planRecord.durationDays);

    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: "ACTIVE", plan: planRecord.code, endDate },
    });

    const verified = await prisma.payment.update({
      where: { id },
      data: { status: "VERIFIED", verifiedById: req.platformAdmin.id, verifiedAt: new Date() },
    });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "PAYMENT_VERIFIED",
      entityType: "payment",
      entityId: id,
      metadata: { companyId: payment.companyId, amount: payment.amount, plan: planRecord.code },
    });

    res.json(verified);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify payment" });
  }
};

// GET /api/platform/companies
export const getCompanies = async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        subscription: true,
        _count: { select: { stores: true, users: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch companies" });
  }
};

// GET /api/platform/companies/:id
export const getCompanyDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        subscription: true,
        stores: true,
        users: {
          select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        },
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch company" });
  }
};

// PATCH /api/platform/companies/:id/status
export const setCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be true or false" });
    }

    const company = await prisma.company.update({
      where: { id },
      data: { isActive },
    });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: isActive ? "COMPANY_REACTIVATED" : "COMPANY_SUSPENDED",
      entityType: "company",
      entityId: id,
      metadata: { companyName: company.name },
    });

    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update company status" });
  }
};

// GET /api/platform/analytics/overview
export const getPlatformOverview = async (req, res) => {
  try {
    const [companies, plans] = await Promise.all([
      prisma.company.findMany({ include: { subscription: true } }),
      prisma.plan.findMany(),
    ]);

    const priceMap = {};
    plans.forEach((p) => {
      priceMap[p.code] = p.price;
    });

    const totalCompanies = companies.length;

    const subscriptionBreakdown = {
      TRIALING: 0,
      ACTIVE: 0,
      EXPIRED: 0,
      CANCELLED: 0,
      NONE: 0,
    };

    let estimatedMRR = 0;
    let paidChurn = 0;
    let trialChurn = 0;

    companies.forEach((c) => {
      const sub = c.subscription;

      if (!sub) {
        subscriptionBreakdown.NONE++;
        return;
      }

      subscriptionBreakdown[sub.status] =
        (subscriptionBreakdown[sub.status] || 0) + 1;

      if (sub.status === "ACTIVE") {
        estimatedMRR += priceMap[sub.plan] || 0;
      }

      if (sub.status === "EXPIRED") {
        if (sub.plan === "TRIAL") trialChurn++;
        else paidChurn++;
      }
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const signupMap = {};
    companies
      .filter((c) => new Date(c.createdAt) >= sixMonthsAgo)
      .forEach((c) => {
        const month = new Date(c.createdAt).toISOString().slice(0, 7);
        signupMap[month] = (signupMap[month] || 0) + 1;
      });

    const signupsByMonth = Object.entries(signupMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalCompanies,
      subscriptionBreakdown,
      estimatedMRR,
      signupsByMonth,
      paidChurn,
      trialChurn,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

// GET /api/platform/payments  (full history, not just pending)
export const getAllPayments = async (req, res) => {
  try {
    const { status, companyId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};

// POST /api/platform/companies/:id/investigate
const INVESTIGATION_EXPIRY = "2h";

export const startInvestigation = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return res.status(404).json({ message: "Company not found" });

    const gm = await prisma.user.findFirst({
      where: { companyId: id, role: "GENERAL_MANAGER", isActive: true },
    });

    if (!gm) {
      return res.status(400).json({ message: "No active General Manager found for this company" });
    }

    const token = jwt.sign(
      { id: gm.id, companyId: gm.companyId, role: gm.role, investigation: true },
      process.env.JWT_SECRET,
      { expiresIn: INVESTIGATION_EXPIRY }
    );

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "INVESTIGATION_STARTED",
      entityType: "company",
      entityId: id,
      metadata: {
        companyName: company.name,
        impersonatedUserId: gm.id,
        impersonatedUserEmail: gm.email,
      },
    });

    const { passwordHash, ...safeUser } = gm;

    res.json({
      token,
      user: {
        ...safeUser,
        __investigation: {
          platformAdminId: req.platformAdmin.id,
          platformAdminName: req.platformAdmin.name,
          companyId: id,
          companyName: company.name,
          startedAt: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to start investigation" });
  }
};

// POST /api/platform/broadcast
export const createBroadcast = async (req, res) => {
  try {
    const { title, message, priority, companyId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    const where = { role: "GENERAL_MANAGER", isActive: true };
    if (companyId) where.companyId = companyId;

    const targets = await prisma.user.findMany({ where, select: { id: true, companyId: true } });

    await Promise.all(
      targets.map((t) =>
        createNotification({
          companyId: t.companyId,
          storeId: null,
          userId: t.id,
          title,
          message,
          type: "SYSTEM",
          priority: priority || "MEDIUM",
        })
      )
    );

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "BROADCAST_SENT",
      entityType: companyId ? "company" : "platform",
      entityId: companyId || null,
      metadata: { title, message, recipientCount: targets.length },
    });

    res.json({ message: "Broadcast sent", recipientCount: targets.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send broadcast" });
  }
};

// GET /api/platform/audit-log
export const getPlatformAuditLog = async (req, res) => {
  try {
    const logs = await prisma.platformAuditLog.findMany({
      include: { platformAdmin: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch audit log" });
  }
};

// GET /api/platform/support/threads
export const getAllThreads = async (req, res) => {
  try {
    const threads = await prisma.supportThread.findMany({
      include: {
        company: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    const withFlags = threads.map((t) => {
      const latest = t.messages[0];
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        company: t.company,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: latest?.body?.slice(0, 100) || "",
        needsReply: Boolean(latest?.senderUserId),
      };
    });

    res.json(withFlags);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch threads" });
  }
};

// GET /api/platform/support/threads/:id
export const getThreadDetailPlatform = async (req, res) => {
  try {
    const { id } = req.params;

    const thread = await prisma.supportThread.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            senderUser: { select: { id: true, name: true } },
            senderPlatformAdmin: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!thread) return res.status(404).json({ message: "Thread not found" });

    res.json(thread);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch thread" });
  }
};

// POST /api/platform/support/threads/:id/reply
export const replyToThreadAsPlatform = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) return res.status(400).json({ message: "Message is required" });

    const thread = await prisma.supportThread.findUnique({ where: { id } });
    if (!thread) return res.status(404).json({ message: "Thread not found" });

    await prisma.supportMessage.create({
      data: { threadId: id, senderPlatformAdminId: req.platformAdmin.id, body: message },
    });

    await prisma.supportThread.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    const gms = await prisma.user.findMany({
      where: { companyId: thread.companyId, role: "GENERAL_MANAGER", isActive: true },
      select: { id: true },
    });

    await Promise.all(
      gms.map((gm) =>
        createNotification({
          companyId: thread.companyId,
          storeId: null,
          userId: gm.id,
          title: "Support Replied",
          message: `New reply on "${thread.subject}"`,
          type: "SYSTEM",
          priority: "MEDIUM",
        })
      )
    );

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "SUPPORT_REPLY_SENT",
      entityType: "support_thread",
      entityId: id,
      metadata: { companyId: thread.companyId, subject: thread.subject },
    });

    res.status(201).json({ message: "Reply sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reply" });
  }
};

// PATCH /api/platform/support/threads/:id/status
export const setThreadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["OPEN", "CLOSED"].includes(status)) {
      return res.status(400).json({ message: "status must be OPEN or CLOSED" });
    }

    const thread = await prisma.supportThread.update({ where: { id }, data: { status } });

    res.json(thread);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update thread status" });
  }
};