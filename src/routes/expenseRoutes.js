import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  getExpenses,
  createExpense,
  deleteExpense,
} from "../controllers/expenseController.js";
import checkFeatureAccess from "../middleware/checkFeatureAccess.js";

const router = express.Router();

router.get("/", protect, checkPermission("expenses"), checkFeatureAccess("expenses"), getExpenses);
router.post("/", protect, checkPermission("expenses"), checkFeatureAccess("expenses"), createExpense);

// Deletion is GM-only — a branch manager who logs a fake expense
// shouldn't also be able to erase the evidence.
router.delete("/:id", protect, checkPermission("expenses"), checkFeatureAccess("expenses"), deleteExpense);

export default router;