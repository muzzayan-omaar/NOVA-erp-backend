import prisma from "../lib/prisma.js";
import createAuditLog from "../services/auditService.js";

// GET /api/settings/company
export const getCompanySettings = async (req, res) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.context.companyId } });
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/settings/company — GM only
export const updateCompanySettings = async (req, res) => {
  try {
    const { name, email, phone, country, currency, logo, vatRate, lowStockThreshold } = req.body;
    const { companyId, userId } = req.context;

    if (vatRate !== undefined && (vatRate < 0 || vatRate > 1)) {
      return res.status(400).json({ message: "VAT rate must be between 0 and 1 (e.g. 0.18 for 18%)" });
    }
    if (lowStockThreshold !== undefined && Number(lowStockThreshold) < 0) {
      return res.status(400).json({ message: "Low stock threshold cannot be negative" });
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(country !== undefined && { country }),
        ...(currency !== undefined && { currency }),
        ...(logo !== undefined && { logo }),
        ...(vatRate !== undefined && { vatRate: Number(vatRate) }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: Number(lowStockThreshold) }),
      },
    });

    await createAuditLog({
      userId, companyId, storeId: null,
      action: "COMPANY_SETTINGS_UPDATED",
      entityType: "company",
      entityId: companyId,
      metadata: { updatedFields: Object.keys(req.body) },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/settings/sessions — the calling user's own active sessions only
export const getMySessions = async (req, res) => {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where: { userId: req.context.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, createdAt: true, expiresAt: true },
    });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/settings/sessions/:id
export const revokeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.refreshToken.findFirst({ where: { id, userId: req.context.userId } });
    if (!session) return res.status(404).json({ message: "Session not found" });

    await prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
    res.json({ message: "Session revoked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/settings/sessions/revoke-all — the "I think my account is
// compromised" button; forces re-login on every device, including this one.
export const revokeAllSessions = async (req, res) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.context.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ message: "All sessions revoked — you'll need to log in again everywhere" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};