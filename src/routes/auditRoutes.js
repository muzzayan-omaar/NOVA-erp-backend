import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import { getAuditLogs } from "../controllers/auditController.js";

const router = express.Router();

router.get("/", protect, checkPermission("audit"), getAuditLogs);

export default router;