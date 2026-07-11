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

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("OWNER", "MANAGER"),
  createStore
);

router.get(
  "/",
  protect,
  getStores
);

router.post("/switch", protect, switchStore);

router.get(
  "/current",
  protect,
  getCurrentStore
);

router.patch(
  "/:id/status",
  protect,
  authorize("OWNER"),
  toggleStoreStatus
);

export default router;