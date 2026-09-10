import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

import {
  createQuote,
  getQuotes,
  getQuoteDetail,
  updateQuote,
  sendQuote,
  cancelQuote,
  convertQuote,
} from "../controllers/quoteController.js";

const router = express.Router();

router.use(protect, checkPermission("sales"), checkFeatureAccess("sales"));

router.post("/", createQuote);
router.get("/", getQuotes);
router.get("/:id", getQuoteDetail);
router.patch("/:id", updateQuote);
router.post("/:id/send", sendQuote);
router.post("/:id/cancel", cancelQuote);
router.post("/:id/convert", convertQuote);

export default router;