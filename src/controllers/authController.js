import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { createTrialSubscription } from "../services/subscriptionService.js";
import { createNotification } from "../modules/notifications/notification.service.js";
import { generateUniqueBusinessCode } from "../utils/generateBusinessCode.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
} from "../utils/tokens.js";

const sanitizeUser = (user) => {
  const { passwordHash, ...safe } = user;
  return safe;
};

const issueSession = async (res, user, userAgent) => {
  const accessToken = generateAccessToken(user);
  const { raw, hash, expiresAt } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt, userAgent },
  });

  res.cookie(REFRESH_COOKIE_NAME, raw, REFRESH_COOKIE_OPTIONS);
  return accessToken;
};

// NOTE: unreachable — no route currently mounts this (self-registration
// was deliberately disabled). Left here rather than deleted in case a
// deliberate future self-serve tier resurrects it, but it predates the
// Staff ID login system and would need an EmployeeProfile + staffId added
// before it could actually work if ever re-enabled.
export const registerStoreOwner = async (req, res) => {
  try {
    const { companyName, location, name, email, password, phone, country } = req.body;

    if (!companyName || !name || !email || !password) {
      return res.status(400).json({
        message: "Company name, your name, email and password are required",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const businessCode = await generateUniqueBusinessCode(prisma, companyName);

    const company = await prisma.company.create({
      data: { name: companyName, phone, country, businessCode, termsAcceptedAt: new Date() },
    });

    await createTrialSubscription(company.id);

    const store = await prisma.store.create({
      data: { companyId: company.id, name: "Head Office", location, isHeadOffice: true },
    });

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        name,
        email,
        passwordHash,
        role: "GENERAL_MANAGER",
        storeId: store.id,
        activeStoreId: store.id,
      },
    });

    res.status(201).json({ message: "Registered — this endpoint is not currently reachable via any route.", user: sanitizeUser(user), company, store });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/auth/login — unified for every role. Store Code identifies
// the company + store; Staff ID identifies the person (globally unique
// on its own); the two together are checked to actually match, which is
// what makes Store Code a real second factor rather than decoration.
export const loginUser = async (req, res) => {
  try {
    const { storeCode, staffId, password } = req.body;

    if (!storeCode || !staffId || !password) {
      return res.status(400).json({ message: "Store code, staff ID, and password are required" });
    }

    const store = await prisma.store.findUnique({
      where: { storeCode: storeCode.trim().toUpperCase() },
      include: { company: true },
    });

    if (!store) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!store.company.isActive) {
      return res.status(403).json({ message: "This account has been suspended. Contact support." });
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: { staffId: staffId.trim().toUpperCase() },
      include: { user: { include: { store: true, company: true } } },
    });

    if (!profile || !profile.user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = profile.user;

    if (user.storeId !== store.id) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      const gms = await prisma.user.findMany({
        where: { companyId: user.companyId, role: "GENERAL_MANAGER", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        gms.map((gm) =>
          createNotification({
            companyId: user.companyId,
            storeId: null,
            userId: gm.id,
            title: "Failed Login Attempt",
            message: `A failed login attempt was made for staff ID ${staffId.toUpperCase()} (${user.name}).`,
            type: "FAILED_LOGIN",
            priority: "MEDIUM",
            uniqueKey: `FAILED_LOGIN_${user.id}_${new Date().toISOString().slice(0, 13)}`,
          })
        )
      ).catch(() => {});

      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = await issueSession(res, user, req.headers["user-agent"]);

    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const tokenHash = hashRefreshToken(rawToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
      return res.status(401).json({ message: "Session expired — please log in again" });
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId },
      include: { company: true, store: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Session expired — please log in again" });
    }

    if (!user.company.isActive) {
      return res.status(403).json({ message: "This account has been suspended. Contact support." });
    }

    const { raw, hash, expiresAt } = generateRefreshToken();

    await prisma.$transaction([
      prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
      prisma.refreshToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt, userAgent: req.headers["user-agent"] },
      }),
    ]);

    res.cookie(REFRESH_COOKIE_NAME, raw, REFRESH_COOKIE_OPTIONS);

    const accessToken = generateAccessToken(user);
    res.json({ token: accessToken, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to refresh session" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashRefreshToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to log out" });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { company: true, store: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.company.isActive) {
      return res.status(403).json({ message: "This account has been suspended. Contact support." });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { userId } = req.context;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    const { passwordHash: _, ...safeUser } = updated;

    res.json({ message: "Password updated", user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to change password" });
  }
};