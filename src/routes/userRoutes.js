import express from "express";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

import protect from "../middleware/protect.js";
import authorize from "../middleware/authorize.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

router.get(
"/",
protect,
checkPermission("users"),
getUsers
);

router.post(
"/",
protect,
checkPermission("users"),
createUser
);

router.patch(
"/:id",
protect,
checkPermission("users"),
updateUser
);

router.delete(
"/:id",
protect,
checkPermission("users"),
deleteUser
);

export default router;