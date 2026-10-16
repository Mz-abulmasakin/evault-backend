
// src/modules/notifications/notification.controller.js

import {
  getUserNotifications,
  getUnreadUserNotifications,
  getUnreadCount,
  readNotification,
  readAllNotifications,
  removeNotification,
  removeAllNotifications,
} from "./notification.service.js";


/**
 * =========================================================
 * GET ALL NOTIFICATIONS
 * =========================================================
 */
export async function getNotifications(req, res) {

  try {

    const userId =
      req.user.id;


    const notifications =
      await getUserNotifications(
        userId
      );


    return res.status(200).json({

      success:
        true,

      data:
        notifications,

    });

  } catch (error) {

    console.error(
      "Get Notifications Error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to fetch notifications",

    });

  }

}


/**
 * =========================================================
 * GET UNREAD NOTIFICATIONS
 * =========================================================
 */
export async function getUnreadNotifications(
  req,
  res
) {

  try {

    const userId =
      req.user.id;


    const notifications =
      await getUnreadUserNotifications(
        userId
      );


    return res.status(200).json({

      success:
        true,

      data:
        notifications,

    });

  } catch (error) {

    console.error(
      "Unread Notifications Error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to fetch unread notifications",

    });

  }

}


/**
 * =========================================================
 * GET UNREAD COUNT
 * =========================================================
 */
export async function getNotificationCount(
  req,
  res
) {

  try {

    const userId =
      req.user.id;


    const count =
      await getUnreadCount(
        userId
      );


    return res.status(200).json({

      success:
        true,

      count,

    });

  } catch (error) {

    console.error(
      "Notification Count Error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to get notification count",

    });

  }

}


/**
 * =========================================================
 * MARK ONE AS READ
 * =========================================================
 */
export async function markAsRead(
  req,
  res
) {

  try {

    const {
      id,
    } = req.params;


    const userId =
      req.user.id;


    const notification =
      await readNotification(
        id,
        userId
      );


    if (!notification) {

      return res.status(404).json({

        success:
          false,

        message:
          "Notification not found",

      });

    }


    return res.status(200).json({

      success:
        true,

      data:
        notification,

    });

  } catch (error) {

    console.error(
      "Mark Read Error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to update notification",

    });

  }

}


/**
 * =========================================================
 * MARK ALL AS READ
 * =========================================================
 */
export async function markAllAsRead(
  req,
  res
) {

  try {

    const userId =
      req.user.id;


    await readAllNotifications(
      userId
    );


    return res.status(200).json({

      success:
        true,

      message:
        "All notifications marked as read",

    });

  } catch (error) {

    console.error(
      "Mark All Read Error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to update notifications",

    });

  }

}


/**
 * =========================================================
 * DELETE ONE
 * =========================================================
 */
export async function deleteNotification(
  req,
  res
) {

  try {

    const {
      id,
    } = req.params;


    const userId =
      req.user.id;


    const notification =
      await removeNotification(
        id,
        userId
      );


    if (!notification) {

      return res.status(404).json({

        success:
          false,

        message:
          "Notification not found",

      });

    }


    return res.status(200).json({

      success:
        true,

      message:
        "Notification deleted",

    });

  } catch (error) {

    console.error(
      "Delete Notification Error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to delete notification",

    });

  }

}


/**
 * =========================================================
 * DELETE ALL
 * =========================================================
 */
export async function deleteAllNotifications(
  req,
  res
) {

  try {

    const userId =
      req.user.id;


    await removeAllNotifications(
      userId
    );


    return res.status(200).json({

      success:
        true,

      message:
        "All notifications deleted",

    });

  } catch (error) {

    console.error(
      "Delete All Notifications Error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to delete notifications",

    });

  }

}

