import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

// Completely separate from protect.js — a tenant's JWT (no `type: "platform"`
// claim) is rejected here even if somehow replayed against these routes.
const protectPlatform = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "platform") {
      return res.status(401).json({ message: "Invalid token" });
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { id: decoded.id } });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Account not found" });
    }

    req.platformAdmin = admin;
    next();
  } catch (err) {
    console.error("❌ PLATFORM AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default protectPlatform;