// src/modules/notification/notification.repository.js

import db from "../../config/database.js";


/**
 * =========================================================
 * CREATE NOTIFICATION
 * =========================================================
 */
export async function createNotification(
  data,
  client = db
) {

  const {
    userId,
    title,
    message,
    type = "INFO",
    isRead = false,
    metadata = {},
  } = data;


  const result =
    await client.query(
      `
      INSERT INTO notifications
      (
        user_id,
        title,
        message,
        type,
        is_read,
        data
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      RETURNING *
      `,
      [
        userId,
        title,
        message,
        type,
        isRead,
        metadata,
      ]
    );


  return result.rows[0];
}


/**
 * =========================================================
 * FIND NOTIFICATION BY ID
 * =========================================================
 */
export async function findNotificationById(
  id,
  userId
) {

  const result =
    await db.query(
      `
      SELECT *
      FROM notifications
      WHERE
        id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [
        id,
        userId,
      ]
    );


  return result.rows[0] || null;
}


/**
 * =========================================================
 * GET ALL USER NOTIFICATIONS
 * =========================================================
 */
export async function findNotificationsByUser(
  userId
) {

  const result =
    await db.query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );


  return result.rows;
}


/**
 * =========================================================
 * GET UNREAD USER NOTIFICATIONS
 * =========================================================
 */
export async function findUnreadNotifications(
  userId
) {

  const result =
    await db.query(
      `
      SELECT *
      FROM notifications
      WHERE
        user_id = $1
        AND is_read = false
      ORDER BY created_at DESC
      `,
      [userId]
    );


  return result.rows;
}


/**
 * =========================================================
 * COUNT UNREAD
 * =========================================================
 */
export async function countUnreadNotifications(
  userId
) {

  const result =
    await db.query(
      `
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE
        user_id = $1
        AND is_read = false
      `,
      [userId]
    );


  return Number(
    result.rows[0]?.total || 0
  );
}


/**
 * =========================================================
 * MARK ONE AS READ
 * =========================================================
 */
export async function markNotificationAsRead(
  id,
  userId
) {

  const result =
    await db.query(
      `
      UPDATE notifications
      SET
        is_read = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = $1
        AND user_id = $2
      RETURNING *
      `,
      [
        id,
        userId,
      ]
    );


  return result.rows[0] || null;
}


/**
 * =========================================================
 * MARK ALL AS READ
 * =========================================================
 */
export async function markAllNotificationsAsRead(
  userId
) {

  await db.query(
    `
    UPDATE notifications
    SET
      is_read = true,
      updated_at = CURRENT_TIMESTAMP
    WHERE
      user_id = $1
      AND is_read = false
    `,
    [userId]
  );


  return true;
}


/**
 * =========================================================
 * DELETE ONE
 * =========================================================
 */
export async function deleteNotification(
  id,
  userId
) {

  const result =
    await db.query(
      `
      DELETE FROM notifications
      WHERE
        id = $1
        AND user_id = $2
      RETURNING *
      `,
      [
        id,
        userId,
      ]
    );


  return result.rows[0] || null;
}


/**
 * =========================================================
 * DELETE ALL
 * =========================================================
 */
export async function deleteAllNotifications(
  userId
) {

  await db.query(
    `
    DELETE FROM notifications
    WHERE user_id = $1
    `,
    [userId]
  );


  return true;
}