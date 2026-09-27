import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  getCompanySettings,
  updateCompanySettings,
  getMySessions,
  revokeSession,
  revokeAllSessions,
} from "../controllers/settingsController.js";

const router = express.Router();

router.use(protect);

// Company-level — GM only, reuses the same "audit" permission tier as
// every other sensitive oversight action in this app.
router.get("/company", checkPermission("audit"), getCompanySettings);
router.patch("/company", checkPermission("audit"), updateCompanySettings);

// Personal — any authenticated user, always scoped to themselves only.
router.get("/sessions", getMySessions);
router.delete("/sessions/:id", revokeSession);
router.post("/sessions/revoke-all", revokeAllSessions);

export default router;