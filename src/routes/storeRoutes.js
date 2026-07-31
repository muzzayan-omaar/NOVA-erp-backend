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

const router = express.Router();

router.post(
  "/",
  protect,
  checkPermission("stores"),
  createStore
);

router.get(
"/",
protect,
checkPermission("stores"),
getStores
);

router.post("/switch", protect, switchStore);

router.get(
  "/current",
  protect,
  checkPermission("stores"),
  getCurrentStore
);

router.patch(
  "/:id/status",
  protect,
  checkPermission("stores"),
  toggleStoreStatus
);

export default router;