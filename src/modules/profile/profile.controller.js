// src/modules/profile/profile.controller.js

import {
  createTransactionPin,
  changeTransactionPin,
  verifyTransactionPin,
  getTransactionPinStatus,
} from "./profile.service.js";

// =========================================================
// CREATE TRANSACTION PIN
// =========================================================

export async function createPin(req, res) {
  try {
    const userId = req.user.id;
    const { password, pin } = req.body || {};

    const result = await createTransactionPin(
      userId,
      password,
      pin
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error(
      "CREATE TRANSACTION PIN ERROR:",
      error.message
    );

    const statusCode =
      error.message === "User not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
}

// =========================================================
// CHANGE TRANSACTION PIN
// =========================================================

export async function changePin(req, res) {
  try {
    const userId = req.user.id;

    const {
      currentPin,
      newPin,
    } = req.body || {};

    if (
      typeof currentPin !== "string" ||
      typeof newPin !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current PIN and new PIN are required.",
      });
    }

    const result = await changeTransactionPin(
      userId,
      currentPin,
      newPin
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "CHANGE TRANSACTION PIN ERROR:",
      error.message
    );

    const statusCode =
      error.message === "User not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message:
        error.message ||
        "Unable to change transaction PIN.",
    });
  }
}

// =========================================================
// GET TRANSACTION PIN STATUS
// =========================================================

export async function getPinStatus(req, res) {
  try {
    const userId = req.user.id;

    const result = await getTransactionPinStatus(
      userId
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "GET TRANSACTION PIN STATUS ERROR:",
      error.message
    );

    if (error.message === "User not found.") {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve transaction PIN status.",
    });
  }
}

// =========================================================
// VERIFY TRANSACTION PIN
// Existing operation preserved
// =========================================================

export async function verifyPin(req, res) {
  try {
    const userId = req.user.id;
    const { pin } = req.body || {};

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: "Transaction PIN is required.",
      });
    }

    const result = await verifyTransactionPin(
      userId,
      pin
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "VERIFY TRANSACTION PIN ERROR:",
      error.message
    );

    const statusCode =
      error.message === "User not found." ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
}