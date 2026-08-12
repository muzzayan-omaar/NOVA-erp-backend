import express from "express";
import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";

import {
  createStore,
  getStores,
  switchStore,
  getCurrentStore,
  toggleStoreStatus,
} from "../controllers/storeController.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

router.post(
  "/",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  createStore
);

router.get(
  "/",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  getStores
);

router.post("/switch", protect, switchStore);

router.get(
  "/current",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  getCurrentStore
);

router.patch(
  "/:id/status",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  toggleStoreStatus
);

export default router;