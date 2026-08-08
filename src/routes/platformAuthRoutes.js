// platformAuthRoutes.js
import express from "express";
import { loginPlatformAdmin } from "../controllers/platformAuthController.js";

const router = express.Router();
router.post("/login", loginPlatformAdmin);

export default router;