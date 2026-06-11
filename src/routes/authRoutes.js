import express from "express";
import { registerStoreOwner, loginUser } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerStoreOwner);
router.post("/login", loginUser);

export default router;