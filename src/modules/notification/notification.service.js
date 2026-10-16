
// src/modules/notifications/notification.service.js

import {
  createNotification,
  findNotificationsByUser,
  findUnreadNotifications,
  countUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "./notification.repository.js";


/**
 * =========================================================
 * WALLET FUNDING NOTIFICATION
 * =========================================================
 */
export async function notifyWalletFunding({
  userId,
  amount,
  balance,
  reference,
}) {

  return await createNotification({

    userId,

    title:
      "Wallet Funded",

    message:
      `Your wallet has been credited with ₦${Number(amount).toLocaleString(
        "en-NG",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}. Your new balance is ₦${Number(balance).toLocaleString(
        "en-NG",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}.`,

    type:
      "FUNDING",

    isRead:
      false,

    metadata: {
      service:
        "WALLET_FUNDING",

      reference,

      amount:
        Number(amount),

      balance:
        Number(balance),
    },

  });

}


/**
 * =========================================================
 * AIRTIME PURCHASE NOTIFICATION
 * =========================================================
 */
export async function notifyAirtimePurchase({
  userId,
  amount,
  network,
  phoneNumber,
  reference,
  status = "SUCCESS",
  refundReference = null,
}) {

  const successful =
    status === "SUCCESS";


  const title =
    successful
      ? "Airtime Purchase Successful"
      : "Airtime Purchase Failed";


  let message;


  if (successful) {

    message =
      `₦${Number(amount).toLocaleString(
        "en-NG",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )} airtime was successfully sent to ${phoneNumber} on ${network}.`;

  } else {

    message =
      `Your ₦${Number(amount).toLocaleString(
        "en-NG",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )} airtime purchase to ${phoneNumber} on ${network} failed. Your wallet has been refunded.`;

  }


  return await createNotification({

    userId,

    title,

    message,

    type:
      "TRANSACTION",

    isRead:
      false,

    metadata: {

      service:
        "AIRTIME",

      amount:
        Number(amount),

      network,

      phoneNumber,

      reference,

      status,

      refundReference,

    },

  });

}


/**
 * =========================================================
 * GET USER NOTIFICATIONS
 * =========================================================
 */
export async function getUserNotifications(
  userId
) {

  return await findNotificationsByUser(
    userId
  );

}


/**
 * =========================================================
 * GET UNREAD NOTIFICATIONS
 * =========================================================
 */
export async function getUnreadUserNotifications(
  userId
) {

  return await findUnreadNotifications(
    userId
  );

}


/**
 * =========================================================
 * GET UNREAD COUNT
 * =========================================================
 */
export async function getUnreadCount(
  userId
) {

  return await countUnreadNotifications(
    userId
  );

}


/**
 * =========================================================
 * MARK ONE AS READ
 * =========================================================
 */
export async function readNotification(
  id,
  userId
) {

  return await markNotificationAsRead(
    id,
    userId
  );

}


/**
 * =========================================================
 * MARK ALL AS READ
 * =========================================================
 */
export async function readAllNotifications(
  userId
) {

  return await markAllNotificationsAsRead(
    userId
  );

}


/**
 * =========================================================
 * DELETE ONE
 * =========================================================
 */
export async function removeNotification(
  id,
  userId
) {

  return await deleteNotification(
    id,
    userId
  );

}


/**
 * =========================================================
 * DELETE ALL
 * =========================================================
 */
export async function removeAllNotifications(
  userId
) {

  return await deleteAllNotifications(
    userId
  );

}

