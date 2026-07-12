import express from "express";
import protect from "../middleware/protect.js";

import {
createPayroll,
getPayroll
} from "../controllers/payrollController.js";


const router = express.Router();


router.post("/",protect,createPayroll);

router.get("/",protect,getPayroll);


export default router;