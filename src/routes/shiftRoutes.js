import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";
import {
  openShift,
  getCurrentShift,
  closeShift,
  getShifts,
  getShiftDetail,
  getShiftPreview,
} from "../controllers/shiftController.js";

const router = express.Router();

router.use(protect);

router.post("/open", checkPermission("sales"), checkFeatureAccess("sales"), openShift);
router.get("/current", getCurrentShift);
router.get("/:id/preview", getShiftPreview);
router.post("/:id/close", checkPermission("sales"), checkFeatureAccess("sales"), closeShift);

// GM-only oversight list — ownership for individual shift detail is
// enforced inside the controller itself, not here.
router.get("/", checkPermission("audit"), getShifts);
router.get("/:id", getShiftDetail);

export default router;