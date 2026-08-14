import express from "express";
import protect from "../middleware/protect.js";

import {
  getMovements,
  adjustStock,
  transferStock,
} from "../controllers/inventoryController.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

/**
 * Inventory movements
 * GET /api/inventory/movements
 */
router.get(
  "/movements",
  protect,
  checkPermission("inventory"),
  getMovements
);

/**
 * Stock adjustment
 * POST /api/inventory/adjust
 */
router.post(
  "/adjust",
  protect,
  checkPermission("inventory"),
  checkFeatureAccess("inventory"),
  adjustStock
);

router.post(
  "/transfer",
  protect,
  checkPermission("inventory"),
  checkFeatureAccess("inventory"),
  transferStock
);

export default router;