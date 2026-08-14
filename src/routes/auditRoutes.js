import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import { getAuditLogs } from "../controllers/auditController.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

router.get("/", protect, checkPermission("audit"), checkFeatureAccess("audit"), getAuditLogs);

export default router;
