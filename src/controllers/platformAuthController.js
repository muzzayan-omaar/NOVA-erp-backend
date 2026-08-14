import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const sanitize = (admin) => {
  const { passwordHash, ...safe } = admin;
  return safe;
};

// POST /api/platform/auth/login
// Deliberately no register endpoint — platform admin accounts are created
// only via the one-off seed script, never through a public API.
export const loginPlatformAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { email } });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, admin.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: admin.id, type: "platform" }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token, admin: sanitize(admin) });
  } catch (err) {
    console.error("PLATFORM LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
