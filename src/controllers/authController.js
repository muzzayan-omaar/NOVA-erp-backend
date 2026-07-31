import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import generateToken from "../utils/generateToken.js";

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

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create company
    const company = await prisma.company.create({
      data: {
        name: companyName,
        phone,
        country,
      },
    });

    // Create Head Office
    const store = await prisma.store.create({
      data: {
        companyId: company.id,
        name: "Head Office",
        location,
        isHeadOffice: true,
      },
    });

    // Create owner
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
      user,
      company,
      store,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password, companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        message: "Company is required for login",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        companyId_email: {
          companyId,
          email,
        },
      },
      include: {
        company: true,
        store: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user);

    res.json({
      token,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
};