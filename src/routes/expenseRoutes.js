import express from "express";
import protect from "../middleware/protect.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  getExpenses,
  createExpense,
  deleteExpense,
} from "../controllers/expenseController.js";

const router = express.Router();

router.get("/", protect, checkPermission("expenses"), getExpenses);
router.post("/", protect, checkPermission("expenses"), createExpense);

// Deletion is GM-only — a branch manager who logs a fake expense
// shouldn't also be able to erase the evidence.
router.delete("/:id", protect, checkPermission("audit"), deleteExpense);

export default router;