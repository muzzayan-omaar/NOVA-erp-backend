import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

import {
  getPurchaseOrders,
  getPurchaseOrderDetail,
  createPurchaseOrder,
  sendPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from "../controllers/purchaseOrderController.js";

const router = express.Router();

router.use(protect, checkPermission("suppliers"), checkFeatureAccess("suppliers"));

router.get("/", getPurchaseOrders);
router.get("/:id", getPurchaseOrderDetail);
router.post("/", createPurchaseOrder);
router.post("/:id/send", sendPurchaseOrder);
router.post("/:id/receive", receivePurchaseOrder);
router.post("/cancel/:id", cancelPurchaseOrder);

export default router;