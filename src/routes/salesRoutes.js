import express from "express";
import protect from "../middleware/protect.js";

import {
  createSale,
  getSales,
  getTodayStats
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



export default router;