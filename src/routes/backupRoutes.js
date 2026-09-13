import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import { triggerBackupNow } from "../controllers/backupController.js";

const router = express.Router();

// Reuses the "audit" permission — GM-only, same as every other
// sensitive/oversight action in this app.
router.post("/send-now", protect, checkPermission("audit"), triggerBackupNow);

export default router;