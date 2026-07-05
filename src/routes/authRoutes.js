import express from "express";
import {
  registerStoreOwner,
  loginUser,
} from "../controllers/authController.js";

import protect from "../middleware/protect.js";
import { switchStore } from "../controllers/storeController.js";

const router = express.Router();

router.post("/register", registerStoreOwner);
router.post("/login", loginUser);

// authenticated
router.post("/switch-store", protect, switchStore);

export default router;