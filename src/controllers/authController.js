import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import generateToken from "../utils/generateToken.js";
import { createTrialSubscription } from "../services/subscriptionService.js";
import { createNotification } from "../modules/notifications/notification.service.js";

const sanitizeUser = (user) => {
  const { passwordHash, ...safe } = user;
  return safe;
};

export const registerStoreOwner = async (req, res) => {
  try {
    const {
      companyName,
      location,
      name,
      email,
      password,
      phone,
      country,
    } = req.body;

    if (!companyName || !name || !email || !password) {
      return res.status(400).json({
        message: "Company name, your name, email and password are required",
      });
    }

    // Company must exist first before we can check companyId+email uniqueness,
    // so instead check if this email is already used anywhere under a company
    // with the same name (best-effort duplicate guard at signup time).
    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: { name: companyName, phone, country },
    });

    // Create trial subscription right after company is created
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
    const { email, password, companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Company is required for login" });
    }

    const user = await prisma.user.findUnique({
      where: { companyId_email: { companyId, email } },
      include: { company: true, store: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Suspended company → block login
    if (!user.company.isActive) {
      return res.status(403).json({
        message: "This account has been suspended. Contact support.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: sanitizeUser(user),
    });
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

    // Optional: also block here if company was suspended while token is still valid
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