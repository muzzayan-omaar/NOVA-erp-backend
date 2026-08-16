import express from "express";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerDetail,
  recordCustomerPayment,
} from "../controllers/customerController.js";

import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

router.use(protect);

// Read access stays open to any authenticated role — a cashier needs to
// look up a customer at POS for a credit sale.
router.get("/", getCustomers);

// These need the "customers" permission specifically — cashiers do have
// it (they legitimately add walk-in customers and record payments), but
// this is no longer a free pass since no financial field is settable here.
router.post("/", checkPermission("customers"), createCustomer);
router.put("/:id", checkPermission("customers"), updateCustomer);
router.get("/:id/detail", checkPermission("customers"), getCustomerDetail);
router.post("/:id/pay", checkPermission("customers"), recordCustomerPayment);

// Deletion can erase a customer's whole credit history — same reasoning
// as expense deletion being GM-only.
router.delete("/:id", checkPermission("audit"), deleteCustomer);

export default router;