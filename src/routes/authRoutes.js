import express from "express";
import {
  registerStoreOwner,
  loginUser,
  getCurrentUser,
  changePassword,
} from "../controllers/authController.js";

import protect from "../middleware/protect.js";
import { switchStore } from "../controllers/storeController.js";

const router = express.Router();

router.post("/register", registerStoreOwner);
router.post("/login", loginUser);

// authenticated
router.post("/switch-store", protect, switchStore);

router.get(
    "/me",
    protect,
    getCurrentUser
);
router.post("/change-password", protect, changePassword);
export default router;