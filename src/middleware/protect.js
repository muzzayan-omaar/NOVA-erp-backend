import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const protect = async (req, res, next) => {
  try {
    console.log("🔐 AUTH HIT");

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ NO TOKEN");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ TOKEN DECODED:", decoded);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        storeId: true,
        activeStoreId: true,
        isActive: true,
      },
    });

    console.log("👤 USER FOUND:", user);

    if (!user || !user.isActive) {
      console.log("❌ USER INVALID");
      return res.status(401).json({ message: "Account not found" });
    }

    const storeId = user.activeStoreId || user.storeId;

    req.user = user;
    req.context = {
      companyId: user.companyId,
      storeId,
      userId: user.id,
      role: user.role,
    };

    console.log("✅ CONTEXT SET:", req.context);

    next();
  } catch (err) {
    console.error("❌ AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default protect;