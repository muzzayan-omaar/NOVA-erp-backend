import express from "express";
import { getPaymentSummary } from "../controllers/paymentsController.js";
import protect from "../middleware/protect.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

router.get(
  "/summary",
  protect,
  checkPermission("payments"),
  checkFeatureAccess("payments"),
  getPaymentSummary
);

export default router;