import express from "express";
import { getMovements, adjustStock } from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/movements", getMovements);
router.post("/adjust", adjustStock);

export default router;