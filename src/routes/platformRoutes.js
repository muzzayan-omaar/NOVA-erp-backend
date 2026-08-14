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
  updateBusinessCode,
  createCompanyOnboarding,
  addBundlesToCompany,
} from "../controllers/platformController.js";
import {
  getAllBundles,
  createBundle,
  updateBundle,
  setBundleStatus,
  getAllPackages,
  createPackage,
  updatePackage,
  setPackageStatus,
  getAllBillingCycles,
  createBillingCycle,
  updateBillingCycle,
  setBillingCycleStatus,
} from "../controllers/catalogController.js";
import { validate } from "../middleware/validate.js";
import { onboardingSchema } from "../schemas/platformSchemas.js";

const router = express.Router();

router.use(protectPlatform);

router.get("/payments/pending", getPendingPayments);
router.post("/payments/:id/verify", verifyPayment);

router.get("/companies", getCompanies);
router.get("/companies/:id", getCompanyDetail);
router.patch("/companies/:id/status", setCompanyStatus);
router.patch("/companies/:id/business-code", updateBusinessCode);
router.post("/companies/:id/investigate", startInvestigation);

router.get("/analytics/overview", getPlatformOverview);
router.get("/payments", getAllPayments);

router.get("/bundles", getAllBundles);
router.post("/bundles", createBundle);
router.patch("/bundles/:id", updateBundle);
router.patch("/bundles/:id/status", setBundleStatus);

router.get("/packages", getAllPackages);
router.post("/packages", createPackage);
router.patch("/packages/:id", updatePackage);
router.patch("/packages/:id/status", setPackageStatus);

router.get("/billing-cycles", getAllBillingCycles);
router.post("/billing-cycles", createBillingCycle);
router.patch("/billing-cycles/:id", updateBillingCycle);
router.patch("/billing-cycles/:id/status", setBillingCycleStatus);

router.post("/broadcast", createBroadcast);
router.get("/audit-log", getPlatformAuditLog);

router.get("/support/threads", getAllThreads);
router.get("/support/threads/:id", getThreadDetailPlatform);
router.post("/support/threads/:id/reply", replyToThreadAsPlatform);
router.patch("/support/threads/:id/status", setThreadStatus);
router.post("/companies", validate(onboardingSchema), createCompanyOnboarding);
router.post("/companies/:id/bundles", addBundlesToCompany);

export default router;
