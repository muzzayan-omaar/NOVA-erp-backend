import express from "express";
import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";

import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getLowStock,
  resolveScan,
} from "../controllers/productController.js";
import {
  getProductUnits,
  createProductUnit,
  updateProductUnit,
  deleteProductUnit,
} from "../controllers/productUnitController.js";
import {
  getProductSerials,
  addProductSerials,
  updateProductSerialStatus,
  deleteProductSerial,
} from "../controllers/productSerialController.js";
import checkPermission from "../middleware/checkPermission.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

// Product routes
router.post("/", protect, checkPermission("products"), checkFeatureAccess("products"), createProduct);
router.get("/", protect, getProducts);
router.get("/low-stock", protect, checkPermission("products"), getLowStock);
router.get("/resolve-scan", protect, resolveScan);
router.put("/:id", protect, checkPermission("products"), checkFeatureAccess("products"), updateProduct);
router.delete("/:id", protect, checkPermission("products"), deleteProduct);

// Product Unit routes
router.get("/:productId/units", protect, getProductUnits); // open read for cashiers
router.post("/:productId/units", protect, checkPermission("products"), checkFeatureAccess("products"), createProductUnit);
router.patch("/:productId/units/:id", protect, checkPermission("products"), checkFeatureAccess("products"), updateProductUnit);
router.delete("/:productId/units/:id", protect, checkPermission("products"), deleteProductUnit);

// Product Serial routes
router.get("/:productId/serials", protect, getProductSerials); // open read for cashiers
router.post("/:productId/serials", protect, checkPermission("products"), checkFeatureAccess("products"), addProductSerials);
router.patch("/:productId/serials/:id", protect, checkPermission("products"), checkFeatureAccess("products"), updateProductSerialStatus);
router.delete("/:productId/serials/:id", protect, checkPermission("products"), deleteProductSerial);

export default router;