import prisma from "../lib/prisma.js";

// GET /api/audit
// GM-only. Returns audit log across the whole company (all stores),
// so a branch manager's actions are visible to the GM regardless of
// which store the GM is currently switched into.
export const getAuditLogs = async (req, res) => {
  try {
    const { companyId } = req.context;
    const { action, storeId, from, to, limit = 100 } = req.query;

    const where = { companyId };

    if (action) where.action = action;
    if (storeId) where.storeId = storeId;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 100, 500),
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        store: { select: { id: true, name: true } },
      },
    });

    res.json(logs);
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};
