import express from "express";
import protect from "../middleware/protect.js";
import { getDashboardReport } from "../controllers/reportsController.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

// Dashboard Report
router.get("/dashboard", protect, checkFeatureAccess("reports"), getDashboardReport);

export default router;