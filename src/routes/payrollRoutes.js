import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

import {
  createPayroll,
  getPayroll,
  markPayrollPaid,
  getNssfReturn,
} from "../controllers/payrollController.js";

const router = express.Router();

router.use(protect, checkPermission("payroll"), checkFeatureAccess("payroll"));

router.post("/", createPayroll);
router.get("/", getPayroll);
router.post("/:id/pay", markPayrollPaid);
router.get("/nssf-return", getNssfReturn);

export default router;