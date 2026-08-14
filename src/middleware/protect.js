import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import checkSubscription from "./checkSubscription.js";

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
        isPlatformAdmin: true,
        company: { select: { isActive: true } },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Account not found" });
    }

    // Suspended company → block mid-session
    if (!user.company.isActive) {
      return res.status(403).json({
        message: "This account has been suspended. Contact support.",
      });
    }

    const storeId = user.activeStoreId || user.storeId;

    req.user = user;
    req.context = {
      companyId: user.companyId,
      storeId,
      userId: user.id,
      role: user.role,
    };

    // Now properly awaited — any error inside checkSubscription is
    // caught by THIS try/catch instead of becoming a silent hang.
    await checkSubscription(req, res, next);
  } catch (err) {
    console.error("❌ AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default protect;
