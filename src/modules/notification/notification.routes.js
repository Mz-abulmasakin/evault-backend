import express from "express";

import {
  getNotifications,
  getUnreadNotifications,
  getNotificationCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "./notification.controller.js";

import {
  authMiddleware,
} from "../../middleware/auth.middleware.js";


const router =
  express.Router();


router.get(
  "/",
  authMiddleware,
  getNotifications
);


router.get(
  "/unread",
  authMiddleware,
  getUnreadNotifications
);


router.get(
  "/count",
  authMiddleware,
  getNotificationCount
);


router.patch(
  "/:id/read",
  authMiddleware,
  markAsRead
);


router.patch(
  "/read-all",
  authMiddleware,
  markAllAsRead
);


router.delete(
  "/:id",
  authMiddleware,
  deleteNotification
);


router.delete(
  "/",
  authMiddleware,
  deleteAllNotifications
);


export default router;