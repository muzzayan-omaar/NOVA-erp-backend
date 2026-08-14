import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import generateToken from "../utils/generateToken.js";
import { createTrialSubscription } from "../services/subscriptionService.js";
import { createNotification } from "../modules/notifications/notification.service.js";
import { generateUniqueBusinessCode } from "../utils/generateBusinessCode.js";

const sanitizeUser = (user) => {
  const { passwordHash, ...safe } = user;
  return safe;
};

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

    const existingUser = await prisma.user.findUnique({
      where: {
        companyId_email: {
          companyId: company.id,
          email,
        },
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const store = await prisma.store.create({
      data: {
        companyId: company.id,
        name: "Head Office",
        location,
        isHeadOffice: true,
      },
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

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: sanitizeUser(user),
      company,
      store,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * LOGIN
 */
export const loginUser = async (req, res) => {
  try {
    const { businessCode, email, password } = req.body;

    if (!businessCode) {
      return res.status(400).json({ message: "Business code is required for login" });
    }

    const company = await prisma.company.findUnique({
      where: { businessCode: businessCode.trim().toUpperCase() },
    });

    if (!company) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!company.isActive) {
      return res.status(403).json({
        message: "This account has been suspended. Contact support.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
      include: { company: true, store: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      const gms = await prisma.user.findMany({
        where: {
          companyId: user.companyId,
          role: "GENERAL_MANAGER",
          isActive: true,
        },
        select: { id: true },
      });

      await Promise.all(
        gms.map((gm) =>
          createNotification({
            companyId: user.companyId,
            storeId: null,
            userId: gm.id,
            title: "Failed Login Attempt",
            message: `A failed login attempt was made for ${user.email}.`,
            type: "FAILED_LOGIN",
            priority: "MEDIUM",
            uniqueKey: `FAILED_LOGIN_${user.id}_${new Date().toISOString().slice(0, 13)}`,
          })
        )
      ).catch(() => {});

      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      include: {
        company: true,
        store: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.company.isActive) {
      return res.status(403).json({
        message: "This account has been suspended. Contact support.",
      });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { userId } = req.context;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters",
      });
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
