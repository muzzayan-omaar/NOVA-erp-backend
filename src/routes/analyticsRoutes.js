import express from "express";
import protect from "../middleware/protect.js";
import { 
  getDashboardAnalytics, 
  getAdvancedAnalytics 
} from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/", protect, getDashboardAnalytics);
router.get("/advanced", protect, getAdvancedAnalytics);

export default router;