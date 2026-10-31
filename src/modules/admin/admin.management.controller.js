// src/modules/admin/admin.management.controller.js

import {
  getAdminUsers,
  getAdminUserDetails,
  editAdminUser,
  getAdminTransactions,
  getAdminTransactionDetails,
} from "./admin.management.service.js";

function sendError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A customer with one of those details already exists.",
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallbackMessage,
  });
}

export async function listUsers(req, res) {
  try {
    const result = await getAdminUsers(req.query);
    return res.status(200).json({
      success: true,
      message: "Customers retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error, "Failed to retrieve customers.");
  }
}

export async function getUserDetails(req, res) {
  try {
    const user = await getAdminUserDetails(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Customer details retrieved successfully.",
      data: user,
    });
  } catch (error) {
    return sendError(res, error, "Failed to retrieve customer details.");
  }
}

export async function updateUser(req, res) {
  try {
    const user = await editAdminUser(req.params.id, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Customer information updated successfully.",
      data: user,
    });
  } catch (error) {
    return sendError(res, error, "Failed to update customer information.");
  }
}

export async function listTransactions(req, res) {
  try {
    const result = await getAdminTransactions(req.query);
    return res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error, "Failed to retrieve transactions.");
  }
}

export async function getTransactionDetails(req, res) {
  try {
    const transaction = await getAdminTransactionDetails(req.params.identifier);
    return res.status(200).json({
      success: true,
      message: "Transaction details retrieved successfully.",
      data: transaction,
    });
  } catch (error) {
    return sendError(res, error, "Failed to retrieve transaction details.");
  }
}
