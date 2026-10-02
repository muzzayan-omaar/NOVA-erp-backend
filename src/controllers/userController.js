import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import { assertUserCapacity } from "../utils/checkCapacityLimits.js";
import { generateUniqueStaffId } from "../utils/generateStaffId.js";
import { generateTempPassword } from "../utils/generateTempPassword.js";
import createAuditLog from "../services/auditService.js";

const PRESENCE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/** Compute live presence from the newest non-revoked refresh token */
function computePresence(token, now = new Date()) {
  if (!token) return "offline";
  const created = new Date(token.createdAt);
  const expires = new Date(token.expiresAt);
  if (expires <= now) return "offline";
  if (now - created >= PRESENCE_WINDOW_MS) return "offline";
  return "online";
}

/**
 * Resolve the status that the UI should display.
 * Priority: account disabled → valid leave → live presence
 */
function resolveDisplayStatus(user, presence, now = new Date()) {
  if (user.isActive === false) return "INACTIVE";

  const profile = user.employeeProfile;
  const ws = profile?.workStatus;
  const leaveUntil = profile?.leaveUntil ? new Date(profile.leaveUntil) : null;

  // Emergency leave / holiday still valid?
  if (
    (ws === "EMERGENCY_LEAVE" || ws === "HOLIDAY") &&
    leaveUntil &&
    leaveUntil > now
  ) {
    return ws;
  }

  // Leave expired or no special status → fall back to live presence
  return presence === "online" ? "ACTIVE" : "OFF";
}

export const getUsers = async (req, res) => {
  try {
    const companyId = req.context.companyId;

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        activeStoreId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        store: { select: { id: true, name: true } },
        employeeProfile: {
          select: {
            staffId: true,
            position: true,
            shift: true,
            photoUrl: true,
            hireDate: true,
            workStatus: true,
            workStatusUpdatedAt: true,
            leaveUntil: true,
          },
        },
      },
    });

    if (users.length === 0) {
      return res.json([]);
    }

    const userIds = users.map((u) => u.id);

    // Latest non-revoked token per user (efficient single query + reduce)
    const tokens = await prisma.refreshToken.findMany({
      where: {
        userId: { in: userIds },
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        userId: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    const latestTokenByUser = new Map();
    for (const t of tokens) {
      if (!latestTokenByUser.has(t.userId)) {
        latestTokenByUser.set(t.userId, t);
      }
    }

    const now = new Date();

    const result = users.map((u) => {
      const token = latestTokenByUser.get(u.id) || null;
      const presence = computePresence(token, now);
      const displayStatus = resolveDisplayStatus(u, presence, now);

      return {
        ...u,
        presence,           // "online" | "offline"
        displayStatus,      // ACTIVE | OFF | HOLIDAY | EMERGENCY_LEAVE | INACTIVE
        lastSeenAt: token?.createdAt || null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.context;

    const user = await prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        store: { select: { id: true, name: true, storeCode: true } },
        employeeProfile: true,
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Attach live presence so the detail page stays consistent
    const lastToken = await prisma.refreshToken.findFirst({
      where: { userId: id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true },
    });

    const now = new Date();
    const presence = computePresence(lastToken, now);
    const displayStatus = resolveDisplayStatus(user, presence, now);

    res.json({
      ...user,
      presence,
      displayStatus,
      lastSeenAt: lastToken?.createdAt || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const companyId = req.context.companyId;

    const capacity = await assertUserCapacity(companyId);
    if (!capacity.ok) {
      return res.status(400).json({ message: capacity.message });
    }

    const {
      name,
      email,
      role,
      storeId,
      dateOfBirth,
      gender,
      nationalIdType,
      nationalIdNumber,
      educationLevel,
      position,
      shift,
      photoUrl,
      emergencyContactName,
      emergencyContactPhone,
      hireDate,
      defaultBasicSalary,
    } = req.body;

    if (!name || !role || !storeId) {
      return res.status(400).json({ message: "Name, role, and store are required" });
    }

    if (email) {
      const existing = await prisma.user.findUnique({
        where: { companyId_email: { companyId, email } },
      });
      if (existing) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
    }

    const store = await prisma.store.findFirst({ where: { id: storeId, companyId } });
    if (!store) return res.status(404).json({ message: "Store not found" });

    const staffId = await generateUniqueStaffId(prisma);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          companyId,
          name,
          email: email || null,
          passwordHash,
          role,
          storeId,
          activeStoreId: storeId,
          mustChangePassword: true,
        },
      });

      await tx.employeeProfile.create({
        data: {
          userId: newUser.id,
          staffId,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender,
          nationalIdType,
          nationalIdNumber,
          educationLevel,
          position,
          shift,
          photoUrl,
          emergencyContactName,
          emergencyContactPhone,
          hireDate: hireDate ? new Date(hireDate) : null,
          defaultBasicSalary: defaultBasicSalary ? Number(defaultBasicSalary) : null,
          workStatus: "ACTIVE",
          workStatusUpdatedAt: new Date(),
          leaveUntil: null,
        },
      });

      return newUser;
    });

    await createAuditLog({
      userId: req.context.userId,
      companyId,
      storeId,
      action: "STAFF_CREATED",
      entityType: "user",
      entityId: user.id,
      metadata: { name, role, position },
    });

    res.status(201).json({
      message: "Staff member created",
      staffId,
      tempPassword,
      storeCode: store.storeCode,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create user" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.context;

    const {
      name,
      email,
      role,
      isActive,
      dateOfBirth,
      gender,
      nationalIdType,
      nationalIdNumber,
      educationLevel,
      position,
      shift,
      photoUrl,
      emergencyContactName,
      emergencyContactPhone,
      hireDate,
      defaultBasicSalary,
      workStatus,
      leaveDays, // number of days for emergency leave / holiday
    } = req.body;

    const existing = await prisma.user.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: "User not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email: email || null }),
          ...(role !== undefined && { role }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      const hasProfileFields = [
        dateOfBirth,
        gender,
        nationalIdType,
        nationalIdNumber,
        educationLevel,
        position,
        shift,
        photoUrl,
        emergencyContactName,
        emergencyContactPhone,
        hireDate,
        defaultBasicSalary,
        workStatus,
        leaveDays,
      ].some((v) => v !== undefined);

      if (hasProfileFields) {
        let leaveUntil = undefined;

        if (workStatus === "EMERGENCY_LEAVE" || workStatus === "HOLIDAY") {
          const days = Number(leaveDays);
          if (!Number.isFinite(days) || days < 1) {
            throw new Error("Please specify a valid number of leave days (minimum 1)");
          }
          leaveUntil = new Date();
          leaveUntil.setDate(leaveUntil.getDate() + Math.floor(days));
        } else if (workStatus !== undefined) {
          // Clearing leave or switching to ACTIVE/OFF
          leaveUntil = null;
        }

        await tx.employeeProfile.upsert({
          where: { userId: id },
          update: {
            ...(dateOfBirth !== undefined && {
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            }),
            ...(gender !== undefined && { gender }),
            ...(nationalIdType !== undefined && { nationalIdType }),
            ...(nationalIdNumber !== undefined && { nationalIdNumber }),
            ...(educationLevel !== undefined && { educationLevel }),
            ...(position !== undefined && { position }),
            ...(shift !== undefined && { shift }),
            ...(photoUrl !== undefined && { photoUrl }),
            ...(emergencyContactName !== undefined && { emergencyContactName }),
            ...(emergencyContactPhone !== undefined && { emergencyContactPhone }),
            ...(hireDate !== undefined && {
              hireDate: hireDate ? new Date(hireDate) : null,
            }),
            ...(defaultBasicSalary !== undefined && {
              defaultBasicSalary: defaultBasicSalary ? Number(defaultBasicSalary) : null,
            }),
            ...(workStatus !== undefined && {
              workStatus,
              workStatusUpdatedAt: new Date(),
            }),
            ...(leaveUntil !== undefined && { leaveUntil }),
          },
          create: {
            userId: id,
            staffId: await generateUniqueStaffId(tx),
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            gender,
            nationalIdType,
            nationalIdNumber,
            educationLevel,
            position,
            shift,
            photoUrl,
            emergencyContactName,
            emergencyContactPhone,
            hireDate: hireDate ? new Date(hireDate) : null,
            defaultBasicSalary: defaultBasicSalary ? Number(defaultBasicSalary) : null,
            workStatus: workStatus || "ACTIVE",
            workStatusUpdatedAt: new Date(),
            leaveUntil: leaveUntil ?? null,
          },
        });
      }

      return updatedUser;
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    const message = err.message?.includes("leave days")
      ? err.message
      : err.message || "Failed to update user";
    res.status(400).json({ message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.context;

    const existing = await prisma.user.findFirst({ where: { id, companyId } });
    if (!existing) return res.status(404).json({ message: "User not found" });

    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.context;

    const user = await prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        isActive: true,
        employeeProfile: {
          select: {
            workStatus: true,
            leaveUntil: true,
            workStatusUpdatedAt: true,
          },
        },
      },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const [sales7d, sales30d, failedLogins7d, lastToken, recentAudit] =
      await Promise.all([
        prisma.sale.count({
          where: {
            userId: id,
            companyId,
            status: "COMPLETED",
            createdAt: { gte: d7 },
          },
        }),
        prisma.sale.count({
          where: {
            userId: id,
            companyId,
            status: "COMPLETED",
            createdAt: { gte: d30 },
          },
        }),
        prisma.notification.count({
          where: {
            companyId,
            type: "FAILED_LOGIN",
            createdAt: { gte: d7 },
            OR: [
              { userId: id },
              { uniqueKey: { startsWith: `FAILED_LOGIN_${id}_` } },
            ],
          },
        }),
        prisma.refreshToken.findFirst({
          where: { userId: id, revokedAt: null },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, expiresAt: true },
        }),
        prisma.auditLog.findMany({
          where: { companyId, userId: id },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            id: true,
            action: true,
            entityType: true,
            createdAt: true,
            store: { select: { name: true } },
          },
        }),
      ]);

    const presence = computePresence(lastToken, now);
    const displayStatus = resolveDisplayStatus(user, presence, now);
    const lastSeenAt = lastToken?.createdAt || null;

    res.json({
      presence,
      displayStatus,
      lastSeenAt,
      sales7d,
      sales30d,
      failedLogins7d,
      recentAudit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load activity" });
  }
};