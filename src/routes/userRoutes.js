import express from "express";
import { getUsers, createUser, updateUser, deleteUser, getUserDetail  } from "../controllers/userController.js";

import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

router.get("/", protect, checkPermission("users"), checkFeatureAccess("users"), getUsers);

router.get("/:id", protect, checkPermission("users"), getUserDetail);

router.post("/", protect, checkPermission("users"), checkFeatureAccess("users"), createUser);

router.patch("/:id", protect, checkPermission("users"), checkFeatureAccess("users"), updateUser);

router.delete("/:id", protect, checkPermission("users"), checkFeatureAccess("users"), deleteUser);

export default router;
