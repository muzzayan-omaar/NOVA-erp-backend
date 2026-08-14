// subscriptionRoutes.js
import express from "express";
import protect from "../middleware/protect.js";
import {
  getStatus,
  submitPayment,
  getPaymentHistory,
} from "../controllers/subscriptionController.js";

const router = express.Router();

router.get("/status", protect, getStatus);
router.post("/payments", protect, submitPayment);
router.get("/payments", protect, getPaymentHistory);

export default router;
