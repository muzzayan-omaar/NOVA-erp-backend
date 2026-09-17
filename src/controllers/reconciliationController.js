import { matchBankStatement } from "../services/reconciliationService.js";

// POST /api/reconciliation/match
// body: { rows: [{ date, description, amount }], dateToleranceDays? }
// `amount` is signed: positive = money in, negative = money out.
export const reconcileBankStatement = async (req, res) => {
  try {
    const { rows, dateToleranceDays } = req.body;
    const { companyId, storeId } = req.context;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No statement rows provided" });
    }

    const result = await matchBankStatement(companyId, storeId, rows, dateToleranceDays);
    res.json(result);
  } catch (err) {
    console.error("RECONCILIATION ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};