import express from "express";
import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";

import {
  createStore,
  getStores,
  switchStore,
  getCurrentStore,
} from "../controllers/storeController.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("OWNER"),
  createStore
);

router.get(
  "/",
  protect,
  getStores
);

router.post(
  "/switch",
  protect,
  switchStore
);

router.get(
  "/current",
  protect,
  getCurrentStore
);

export default router;