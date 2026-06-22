import express from "express";
import protect from "../middleware/protect.js";
import { createSale, getSales, getTodayStats } from "../controllers/saleController.js";

const router = express.Router();

router.post("/", protect, createSale);
router.get("/", protect, getSales);
router.get("/today-stats", protect, getTodayStats);

export default router;