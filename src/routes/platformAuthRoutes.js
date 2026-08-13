// platformAuthRoutes.js
import express from "express";
import { loginPlatformAdmin } from "../controllers/platformAuthController.js";
import authLimiter from "../middleware/authLimiter.js";
import { validate } from "../middleware/validate.js";
import { platformLoginSchema } from "../schemas/authSchemas.js";

const router = express.Router();

router.post(
  "/login",
  authLimiter,
  validate(platformLoginSchema),
  loginPlatformAdmin
);

export default router;