import express from "express";
import protect from "../middleware/protect.js";
import { getDashboardReport } from "../controllers/reportsController.js";

const router = express.Router();

// Dashboard Report
router.get("/dashboard", protect, getDashboardReport);

export default router;