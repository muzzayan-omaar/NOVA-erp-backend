import express from "express";
import protect from "../middleware/protect.js";
import { getActivePlans } from "../controllers/planController.js";

const router = express.Router();
router.get("/", protect, getActivePlans);

export default router;