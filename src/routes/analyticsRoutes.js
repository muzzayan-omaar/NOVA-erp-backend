import express from "express";
import protect from "../middleware/protect.js";
import { 
 getDashboardAnalytics,
 getAdvancedAnalytics,
 getTaxReport
} from "../controllers/analyticsController.js";
import analyticsAccess from "../middleware/analyticsAccess.js";

const router = express.Router();

router.get(
"/",
protect,
analyticsAccess,
getDashboardAnalytics
);
router.get(
"/advanced",
protect,
analyticsAccess,
getAdvancedAnalytics
);
router.get("/tax", protect, getTaxReport);

export default router;