import express from "express";
import protect from "../middleware/protect.js";

import {
  getMovements,
  adjustStock,
} from "../controllers/inventoryController.js";


const router = express.Router();


/**
 * Inventory movements
 * GET /api/inventory/movements
 */
router.get(
  "/movements",
  protect,
  getMovements
);


/**
 * Stock adjustment
 * POST /api/inventory/adjust
 */
router.post(
  "/adjust",
  protect,
  adjustStock
);


export default router;