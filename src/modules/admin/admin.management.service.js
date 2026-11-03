
// src/modules/admin/admin.management.service.js

import {
  listAdminUsers,
  findAdminUserById,
  emailAlreadyUsedByAnotherUser,
  updateAdminUser,
  listAdminTransactions,
  findAdminTransaction,
} from "./admin.management.repository.js";

/**
 * =========================================================
 * ADMIN MANAGEMENT SERVICE
 * =========================================================
 */

function toPositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function cleanSearch(value) {
  return typeof value === "string"
    ? value.trim().slice(0, 120)
    : "";
}

function makeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateDate(value, fieldName) {
  if (!value) return "";

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw makeError(
      `${fieldName} must use YYYY-MM-DD format.`,
      400
    );
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw makeError(`${fieldName} is not a valid date.`, 400);
  }

  return value;
}

function pagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}

/**
 * =========================================================
 * CUSTOMER MANAGEMENT
 * =========================================================
 */

export async function getAdminUsers(query = {}) {
  const page = toPositiveInteger(query.page, 1, 1000000);
  const limit = toPositiveInteger(query.limit, 20, 100);

  const search = cleanSearch(query.search);
  const status = cleanSearch(query.status).toUpperCase();

  const allowedStatuses = [
    "ACTIVE",
    "SUSPENDED",
    "DISABLED",
  ];

  if (status && !allowedStatuses.includes(status)) {
    throw makeError("Invalid user status filter.", 400);
  }

  const result = await listAdminUsers({
    page,
    limit,
    search,
    status,
  });

  return {
    data: result.rows,
    pagination: pagination(page, limit, result.total),
  };
}

export async function getAdminUserDetails(userId) {
  if (!userId) {
    throw makeError("User ID is required.", 400);
  }

  const user = await findAdminUserById(userId);

  if (!user) {
    throw makeError("User not found.", 404);
  }

  return user;
}

/**
 * =========================================================
 * UPDATE CUSTOMER INFORMATION
 * =========================================================
 */

export async function editAdminUser(userId, body = {}) {
  if (!userId) {
    throw makeError("User ID is required.", 400);
  }

  const fields = {};

  if (Object.prototype.hasOwnProperty.call(body, "fullName")) {
    if (
      typeof body.fullName !== "string" ||
      !body.fullName.trim()
    ) {
      throw makeError("Full name cannot be empty.", 400);
    }

    if (body.fullName.trim().length > 150) {
      throw makeError("Full name is too long.", 400);
    }

    fields.fullName = body.fullName.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    if (typeof body.email !== "string") {
      throw makeError("A valid email address is required.", 400);
    }

    const email = body.email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw makeError("A valid email address is required.", 400);
    }

    if (email.length > 150) {
      throw makeError("Email address is too long.", 400);
    }

    fields.email = email;

    if (
      await emailAlreadyUsedByAnotherUser(
        fields.email,
        userId
      )
    ) {
      throw makeError(
        "That email address is already used by another customer.",
        409
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "phoneNumber")
  ) {
    if (
      typeof body.phoneNumber !== "string" ||
      !body.phoneNumber.trim()
    ) {
      throw makeError("Phone number cannot be empty.", 400);
    }

    const phoneNumber = body.phoneNumber.trim();

    if (phoneNumber.length > 20) {
      throw makeError("Phone number cannot exceed 20 characters.", 400);
    }

    fields.phoneNumber = phoneNumber;
  }

  if (Object.keys(fields).length === 0) {
    throw makeError(
      "Provide at least one editable field: fullName, email or phoneNumber.",
      400
    );
  }

  const updated = await updateAdminUser(userId, fields);

  if (!updated) {
    throw makeError("User not found.", 404);
  }

  return updated;
}

/**
 * =========================================================
 * TRANSACTION MANAGEMENT
 * =========================================================
 */

export async function getAdminTransactions(query = {}) {
  const page = toPositiveInteger(query.page, 1, 1000000);
  const limit = toPositiveInteger(query.limit, 20, 100);

  const search = cleanSearch(query.search);
  const status = cleanSearch(query.status).toUpperCase();
  const type = cleanSearch(query.type).toUpperCase();

  const dateFrom = validateDate(query.dateFrom, "dateFrom");
  const dateTo = validateDate(query.dateTo, "dateTo");

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw makeError(
      "dateFrom cannot be later than dateTo.",
      400
    );
  }

  const result = await listAdminTransactions({
    page,
    limit,
    search,
    status,
    type,
    dateFrom,
    dateTo,
  });

  return {
    data: result.rows,
    pagination: pagination(page, limit, result.total),
  };
}

export async function getAdminTransactionDetails(identifier) {
  if (!identifier) {
    throw makeError(
      "Transaction ID or reference is required.",
      400
    );
  }

  const transaction = await findAdminTransaction(identifier);

  if (!transaction) {
    throw makeError("Transaction not found.", 404);
  }

  return transaction;
}
