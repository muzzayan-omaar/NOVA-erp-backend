import express from "express";
import { getPaymentSummary } from "../controllers/paymentsController.js";
import protect from "../middleware/protect.js";

const router = express.Router();

router.get(
  "/summary",
  protect,
  getPaymentSummary
);

export default router;