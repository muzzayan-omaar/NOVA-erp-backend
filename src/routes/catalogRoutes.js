import express from "express";
import protect from "../middleware/protect.js";
import { getCatalog, getMyEntitlements } from "../controllers/catalogController.js";

const router = express.Router();

router.get("/", protect, getCatalog);
router.get("/my-entitlements", protect, getMyEntitlements);

export default router;
