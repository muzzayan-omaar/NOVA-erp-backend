import express from "express";
import protect from "../middleware/protect.js";

import {
  createSale,
  getSales,
  getTodayStats,
  requestVoidSale,
  requestRefundSale,
  getPendingSaleRequests,
  approveSaleAction,
  rejectSaleAction
} from "../controllers/saleController.js";
import checkPermission from "../middleware/checkPermission.js";


const router = express.Router();



/**
 * Create new sale
 * POST /api/sales
 */
router.post(
"/",
protect,
checkPermission("sales"),
createSale
);



/**
 * Get sales history
 * GET /api/sales
 */
router.get(
  "/",
  protect,
  getSales
);



/**
 * Today's sales statistics
 * GET /api/sales/today-stats
 */
router.get(
  "/today-stats",
  protect,
  getTodayStats
);
router.get("/pending-requests", protect, checkPermission("audit"), getPendingSaleRequests);

router.post("/:id/request-void", protect, requestVoidSale);
router.post("/:id/request-refund", protect, requestRefundSale);


router.post("/:id/approve", protect, checkPermission("audit"), approveSaleAction);
router.post("/:id/reject", protect, checkPermission("audit"), rejectSaleAction);

export default router;