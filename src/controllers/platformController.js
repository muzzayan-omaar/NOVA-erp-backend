import prisma from "../lib/prisma.js";

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

const PLAN_DURATIONS_DAYS = { BASIC: 30, STANDARD: 30, PREMIUM: 30 };

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

    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update company status" });
  }
};

// Plan prices live here as a stopgap until Phase D moves them into a real
// database table you can edit from the dashboard.
const PLAN_PRICES = {
  BASIC: 50000,
  STANDARD: 100000,
  PREMIUM: 180000,
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