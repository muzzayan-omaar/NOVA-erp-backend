import express from "express";
import { getPaymentSummary } from "../controllers/paymentsController.js";

const router = express.Router();

router.get("/summary", getPaymentSummary);

export default router;