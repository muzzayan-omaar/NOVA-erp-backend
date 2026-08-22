import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

import {
  getDayBook,
  getSalesReport,
  getStockSummaryReport,
  getProfitLossReport,
  getCashFlowReport,
  getReceivablesPayablesReport,
  getVatSummaryReport,
  getSupplierAgingReport,
  getReorderAlertsReport, 
} from "../controllers/reportsController.js";

const router = express.Router();

router.use(protect, checkPermission("reports"), checkFeatureAccess("reports"));

router.get("/day-book", getDayBook);
router.get("/sales", getSalesReport);
router.get("/stock-summary", getStockSummaryReport);
router.get("/profit-loss", getProfitLossReport);
router.get("/cash-flow", getCashFlowReport);
router.get("/receivables-payables", getReceivablesPayablesReport);
router.get("/vat-summary", getVatSummaryReport);
router.get("/supplier-aging", getSupplierAgingReport);
router.get("/reorder-alerts", getReorderAlertsReport);

export default router;