import express from "express";
import protect from "../middleware/protect.js";

import { createPayroll, getPayroll } from "../controllers/payrollController.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

router.post("/", protect, createPayroll);

router.get("/", protect, checkPermission("payroll"), checkFeatureAccess("payroll"), getPayroll);

export default router;
