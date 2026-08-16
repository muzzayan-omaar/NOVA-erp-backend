import express from "express";

import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierDetail,
  recordSupplierPayment,
} from "../controllers/supplierController.js";

import protect from "../middleware/protect.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

router.use(protect, checkPermission("suppliers"), checkFeatureAccess("suppliers"));

router.get("/", getSuppliers);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);
router.get("/:id/detail", getSupplierDetail);
router.post("/:id/pay", recordSupplierPayment);

export default router;