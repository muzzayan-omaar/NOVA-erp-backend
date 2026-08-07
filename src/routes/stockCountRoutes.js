import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  createStockCount,
  getStockCounts,
  getStockCountById,
  updateStockCountItems,
  completeStockCount,
} from "../controllers/stockCountController.js";

const router = express.Router();

router.post("/", protect, checkPermission("inventory"), createStockCount);
router.get("/", protect, checkPermission("inventory"), getStockCounts);
router.get("/:id", protect, checkPermission("inventory"), getStockCountById);
router.patch("/:id/items", protect, checkPermission("inventory"), updateStockCountItems);
router.post("/:id/complete", protect, checkPermission("inventory"), completeStockCount);

export default router;