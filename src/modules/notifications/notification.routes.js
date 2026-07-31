import express from "express";

import {

    fetchNotifications,
    unreadNotifications,
    readNotification,
    readAllNotifications

} from "./notification.controller.js";


import protect from "../../middleware/protect.js";



const router = express.Router();



router.use(protect);



// get all notifications

router.get(
    "/",
    fetchNotifications
);



// unread count

router.get(
    "/unread-count",
    unreadNotifications
);



// mark one read

router.patch(
    "/:id/read",
    readNotification
);



// mark all read

router.patch(
    "/read-all",
    readAllNotifications
);



export default router;