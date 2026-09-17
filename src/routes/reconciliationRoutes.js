import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import { reconcileBankStatement } from "../controllers/reconciliationController.js";

const router = express.Router();

// GM-only — this is a financial oversight tool, same tier of trust as
// the Audit Log and Pending Requests.
router.post("/match", protect, checkPermission("audit"), reconcileBankStatement);

export default router;