import express from "express";
import {
  getPaymentSummary,
  getTransactions,
  getTransactionDetail,
} from "../controllers/paymentsController.js";
import protect from "../middleware/protect.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

router.use(protect, checkPermission("payments"), checkFeatureAccess("payments"));

router.get("/summary", getPaymentSummary);
router.get("/transactions", getTransactions);
router.get("/transactions/:id", getTransactionDetail);

export default router;