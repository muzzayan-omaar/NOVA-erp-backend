import express from "express";
import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";

import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getLowStock,
} from "../controllers/productController.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

router.post("/", protect, checkPermission("products"), checkFeatureAccess("products"), createProduct);
router.get("/", protect, getProducts);
router.get("/low-stock", protect, checkPermission("products"), getLowStock);
router.put("/:id", protect, checkPermission("products"), checkFeatureAccess("products"), updateProduct);
router.delete("/:id", protect, checkPermission("products"), deleteProduct);

export default router;