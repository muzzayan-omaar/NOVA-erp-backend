import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  getMyThreads,
  createThread,
  getThreadMessages,
  replyToThread,
} from "../controllers/supportController.js";

const router = express.Router();

router.get("/threads", protect, checkPermission("support"), getMyThreads);
router.post("/threads", protect, checkPermission("support"), createThread);
router.get("/threads/:id", protect, checkPermission("support"), getThreadMessages);
router.post("/threads/:id/reply", protect, checkPermission("support"), replyToThread);

export default router;