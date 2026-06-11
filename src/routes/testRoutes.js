import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get("/db-check", async (req, res) => {
  try {
    const storeCount = await prisma.store.count();
    const userCount = await prisma.user.count();
    
    res.json({
      status: "ok",
      message: "Database connected successfully",
      stores: storeCount,
      users: userCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: error.message,
      code: error.code
    });
  }
});

export default router;