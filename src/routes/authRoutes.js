import express from "express";
import { loginUser, getCurrentUser, changePassword } from "../controllers/authController.js";

import protect from "../middleware/protect.js";
import { switchStore } from "../controllers/storeController.js";
import authLimiter from "../middleware/authLimiter.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, changePasswordSchema } from "../schemas/authSchemas.js";

const router = express.Router();

router.post("/login", authLimiter, validate(loginSchema), loginUser);

router.post("/switch-store", protect, switchStore);
router.get("/me", protect, getCurrentUser);
router.post("/change-password", protect, validate(changePasswordSchema), changePassword);

export default router;
