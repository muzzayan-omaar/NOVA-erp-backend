import prisma from "../lib/prisma.js";
import { assertStoreCapacity } from "../utils/checkCapacityLimits.js";
import { generateUniqueStoreCode } from "../utils/generateStoreCode.js";

/**
 * CREATE STORE (branch)
 */
export const createStore = async (req, res) => {
  try {
    const companyId = req.context.companyId;

    const capacity = await assertStoreCapacity(companyId);
    if (!capacity.ok) {
      return res.status(400).json({ message: capacity.message });
    }

    const { name, location, phone, isHeadOffice } = req.body;

    const storeCode = await generateUniqueStoreCode(prisma, name);

    const store = await prisma.store.create({
      data: {
        name,
        location,
        phone,
        isHeadOffice: isHeadOffice || false,
        isActive: true,
        companyId,
        storeCode,
      },
    });

    res.status(201).json(store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create store" });
  }
};

/**
 * GET STORES (ONLY FOR THIS COMPANY)
 */
export const getStores = async (req, res) => {
  try {
    const companyId = req.context.companyId;

    const stores = await prisma.store.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });

    // Optional enrichment: staff counts (cheap & useful on the list)
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) return res.json([]);

    const staffCounts = await prisma.user.groupBy({
      by: ["storeId"],
      where: { companyId, storeId: { in: storeIds } },
      _count: { id: true },
    });

    const countMap = new Map(
      staffCounts.map((c) => [c.storeId, c._count.id])
    );

    const result = stores.map((s) => ({
      ...s,
      staffCount: countMap.get(s.id) || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch stores" });
  }
};


/**
 * GET SINGLE STORE DETAIL
 */
export const getStoreDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.context.companyId;

    const store = await prisma.store.findFirst({
      where: { id, companyId },
    });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    // ---- Staff at this store ----
    const staff = await prisma.user.findMany({
      where: { companyId, storeId: id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        employeeProfile: {
          select: {
            staffId: true,
            position: true,
            photoUrl: true,
            workStatus: true,
            workStatusUpdatedAt: true,
            // leaveUntil is optional – only include if the column exists
            // If you already ran the migration, you can add: leaveUntil: true
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // ---- Sales snapshot (try storeId first, fall back to users of this store) ----
    let sales7d = 0;
    let sales30d = 0;

    try {
      // Preferred: direct storeId on Sale
      [sales7d, sales30d] = await Promise.all([
        prisma.sale.count({
          where: {
            companyId,
            storeId: id,
            status: "COMPLETED",
            createdAt: { gte: d7 },
          },
        }),
        prisma.sale.count({
          where: {
            companyId,
            storeId: id,
            status: "COMPLETED",
            createdAt: { gte: d30 },
          },
        }),
      ]);
    } catch (saleErr) {
      // Fallback: count sales made by any user who belongs to this store
      console.warn(
        "Sale.storeId query failed, falling back to user-based count:",
        saleErr.message
      );
      const staffIds = staff.map((u) => u.id);
      if (staffIds.length > 0) {
        [sales7d, sales30d] = await Promise.all([
          prisma.sale.count({
            where: {
              companyId,
              userId: { in: staffIds },
              status: "COMPLETED",
              createdAt: { gte: d7 },
            },
          }),
          prisma.sale.count({
            where: {
              companyId,
              userId: { in: staffIds },
              status: "COMPLETED",
              createdAt: { gte: d30 },
            },
          }),
        ]);
      }
    }

    // ---- Live presence ----
    const staffIds = staff.map((u) => u.id);
    const presenceMap = new Map();

    if (staffIds.length > 0) {
      try {
        const tokens = await prisma.refreshToken.findMany({
          where: {
            userId: { in: staffIds },
            revokedAt: null,
          },
          orderBy: { createdAt: "desc" },
          select: {
            userId: true,
            createdAt: true,
            expiresAt: true,
          },
        });

        const latest = new Map();
        for (const t of tokens) {
          if (!latest.has(t.userId)) latest.set(t.userId, t);
        }

        const WINDOW = 30 * 60 * 1000;
        for (const uid of staffIds) {
          const t = latest.get(uid);
          if (
            t &&
            new Date(t.expiresAt) > now &&
            now - new Date(t.createdAt) < WINDOW
          ) {
            presenceMap.set(uid, "online");
          } else {
            presenceMap.set(uid, "offline");
          }
        }
      } catch (tokenErr) {
        console.warn("Presence lookup failed:", tokenErr.message);
      }
    }

    const staffWithPresence = staff.map((u) => {
      const presence = presenceMap.get(u.id) || "offline";
      const profile = u.employeeProfile;
      const ws = profile?.workStatus;

      let displayStatus = "OFF";
      if (u.isActive === false) {
        displayStatus = "INACTIVE";
      } else if (ws === "EMERGENCY_LEAVE" || ws === "HOLIDAY") {
        // Without leaveUntil we still honour the manual status
        displayStatus = ws;
      } else {
        displayStatus = presence === "online" ? "ACTIVE" : "OFF";
      }

      return {
        ...u,
        presence,
        displayStatus,
      };
    });

    const activeStaffCount = staffWithPresence.filter(
      (u) => u.displayStatus === "ACTIVE"
    ).length;

    const manager =
      staffWithPresence.find((u) => u.role === "BRANCH_MANAGER") || null;

    res.json({
      ...store,
      staffCount: staff.length,
      activeStaffCount,
      sales7d,
      sales30d,
      manager,
      staff: staffWithPresence,
    });
  } catch (error) {
    console.error("getStoreDetail error:", error);
    res.status(500).json({
      message: "Failed to load store",
      detail: error.message, // temporary – helps you see the real cause in Network tab
    });
  }
};
/**
 * UPDATE STORE
 */
export const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.context.companyId;
    const { name, location, phone, isHeadOffice, isActive } = req.body;

    const existing = await prisma.store.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Store not found" });
    }

    const updated = await prisma.store.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(location !== undefined && { location: location || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(isHeadOffice !== undefined && { isHeadOffice }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update store" });
  }
};

/**
 * SWITCH ACTIVE STORE
 */
export const switchStore = async (req, res) => {
  try {
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({ message: "Store ID required" });
    }

    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        companyId: req.context.companyId,
        isActive: true,
      },
    });

    if (!store) {
      return res.status(404).json({ message: "Store not available" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.context.userId },
      data: { activeStoreId: store.id },
      include: { activeStore: true },
    });

    res.json({
      message: "Store switched",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to switch store" });
  }
};

/**
 * GET CURRENT STORE
 */
export const getCurrentStore = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.context.userId },
      include: {
        activeStore: true,
        store: true,
      },
    });

    res.json(user.activeStore || user.store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get current store" });
  }
};

export const toggleStoreStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const store = await prisma.store.findFirst({
      where: { id, companyId: req.context.companyId },
    });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const updatedStore = await prisma.store.update({
      where: { id },
      data: { isActive },
    });

    res.json({
      message: "Store status updated",
      store: updatedStore,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update store status" });
  }
};

/**
 * GET /api/stores/options — minimal list for pickers
 */
export const getStoreOptions = async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      where: { companyId: req.context.companyId, isActive: true },
      select: { id: true, name: true, isHeadOffice: true },
      orderBy: { name: "asc" },
    });
    res.json(stores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch store options" });
  }
};