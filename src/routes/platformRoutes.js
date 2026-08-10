import express from "express";
import protectPlatform from "../middleware/protectPlatform.js";
import {
  getPendingPayments,
  verifyPayment,
  getCompanies,
  getCompanyDetail,
  setCompanyStatus,
  getPlatformOverview,
  getAllPayments,
  startInvestigation,
  createBroadcast,
  getPlatformAuditLog,
  getAllThreads,
  getThreadDetailPlatform,
  replyToThreadAsPlatform,
  setThreadStatus,
} from "../controllers/platformController.js";
import { getAllPlans, createPlan, updatePlan, setPlanStatus } from "../controllers/planController.js";

const router = express.Router();

router.use(protectPlatform);

router.get("/payments/pending", getPendingPayments);
router.post("/payments/:id/verify", verifyPayment);

router.get("/companies", getCompanies);
router.get("/companies/:id", getCompanyDetail);
router.patch("/companies/:id/status", setCompanyStatus);
router.post("/companies/:id/investigate", startInvestigation);

router.get("/analytics/overview", getPlatformOverview);
router.get("/payments", getAllPayments);

router.get("/plans", getAllPlans);
router.post("/plans", createPlan);
router.patch("/plans/:id", updatePlan);
router.patch("/plans/:id/status", setPlanStatus);

router.post("/broadcast", createBroadcast);
router.get("/audit-log", getPlatformAuditLog);

router.get("/support/threads", getAllThreads);
router.get("/support/threads/:id", getThreadDetailPlatform);
router.post("/support/threads/:id/reply", replyToThreadAsPlatform);
router.patch("/support/threads/:id/status", setThreadStatus);

export default router;