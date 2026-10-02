import express from "express";
import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";

import {
  createStore,
  getStores,
  switchStore,
  getCurrentStore,
  toggleStoreStatus,
  getStoreOptions,
  getStoreDetail,
  updateStore,
} from "../controllers/storeController.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

// ---- Static / fixed paths FIRST ----
router.get("/options", protect, getStoreOptions);

router.get(
  "/current",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  getCurrentStore
);

router.post("/switch", protect, switchStore);

// ---- Collection ----
router.get(
  "/",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  getStores
);

router.post(
  "/",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  createStore
);

// ---- Param routes (after static ones) ----
router.get(
  "/:id",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  getStoreDetail
);

router.patch(
  "/:id",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  updateStore
);

router.patch(
  "/:id/status",
  protect,
  checkPermission("stores"),
  checkFeatureAccess("stores"),
  toggleStoreStatus
);

export default router;