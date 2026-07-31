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

const router = express.Router();

router.post("/", protect, createProduct);
router.get("/", protect, getProducts);
router.get("/low-stock", protect, checkPermission("products"), getLowStock);
router.put("/:id", protect, checkPermission("products"), updateProduct);
router.delete(
  "/:id",
  protect,
  checkPermission("products"),
  deleteProduct
);

export default router;