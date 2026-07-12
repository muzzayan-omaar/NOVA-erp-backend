import express from "express";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";

const router = express.Router();

router.get(
"/",
protect,
authorize("OWNER","MANAGER"),
getUsers
);

router.post(
"/",
protect,
authorize("OWNER","MANAGER"),
createUser
);

router.patch(
"/:id",
protect,
authorize("OWNER","MANAGER"),
updateUser
);

router.delete(
"/:id",
protect,
authorize("OWNER"),
deleteUser
);

export default router;