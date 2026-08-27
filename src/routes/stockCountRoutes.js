import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

import {
  createStockCount,
  getStockCounts,
  getStockCountById,
  updateStockCountItems,
  submitStockCount,
  getPendingStockCounts,
  approveStockCount,
  rejectStockCount,
} from "../controllers/stockCountController.js";

const router = express.Router();

router.use(protect, checkPermission("inventory"), checkFeatureAccess("inventory"));

// Note: this must come before "/:id" or Express will try to match
// "pending" as an :id parameter.
router.get("/pending/review", checkPermission("audit"), getPendingStockCounts);

router.post("/", createStockCount);
router.get("/", getStockCounts);
router.get("/:id", getStockCountById);
router.patch("/:id/items", updateStockCountItems);
router.post("/:id/submit", submitStockCount);
router.post("/:id/approve", checkPermission("audit"), approveStockCount);
router.post("/:id/reject", checkPermission("audit"), rejectStockCount);

export default router;