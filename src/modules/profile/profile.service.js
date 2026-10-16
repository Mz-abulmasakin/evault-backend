// src/modules/profile/profile.service.js

import bcrypt from "bcrypt";

import {
  findUserById,
  createTransactionPinIfAbsent,
  updateTransactionPinIfHashMatches,
  getTransactionPinHash,
  getTransactionPinStatus as getTransactionPinStatusFromRepository,
} from "./profile.repository.js";

// =========================================================
// PIN VALIDATION
// =========================================================

function validateTransactionPin(pin) {
  if (
    typeof pin !== "string" ||
    !/^\d{4}$/.test(pin)
  ) {
    throw new Error(
      "Transaction PIN must be exactly 4 digits."
    );
  }

  const weakPins = [
    "0000",
    "1111",
    "1234",
    "2222",
    "3333",
    "4444",
    "5555",
    "6666",
    "7777",
    "8888",
    "9999",
    "4321",
    "1212",
    "1122",
    "0123",
    "3210",
    "9876",
    "2580",
  ];

  if (weakPins.includes(pin)) {
    throw new Error(
      "Choose a stronger transaction PIN."
    );
  }
}

// =========================================================
// CREATE TRANSACTION PIN
// =========================================================

export async function createTransactionPin(
  userId,
  password,
  pin
) {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (
    typeof password !== "string" ||
    password.length === 0
  ) {
    throw new Error("Login password is required.");
  }

  if (user.transaction_pin_hash) {
    throw new Error(
      "Transaction PIN already exists. Please use Change PIN."
    );
  }

  validateTransactionPin(pin);

  if (!user.password_hash) {
    throw new Error(
      "Unable to verify your login password."
    );
  }

  const validPassword = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!validPassword) {
    throw new Error("Incorrect password.");
  }

  const pinHash = await bcrypt.hash(pin, 12);

  // Atomic database update prevents two simultaneous requests
  // from creating a PIN over one another.
  const saved = await createTransactionPinIfAbsent(
    userId,
    pinHash
  );

  if (!saved) {
    throw new Error(
      "A transaction PIN already exists or the account could not be updated. Please refresh and try again."
    );
  }

  return {
    success: true,
    message: "Transaction PIN created successfully.",
    hasTransactionPin: true,
  };
}

// =========================================================
// CHANGE EXISTING TRANSACTION PIN
// =========================================================

export async function changeTransactionPin(
  userId,
  currentPin,
  newPin
) {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (!user.transaction_pin_hash) {
    throw new Error(
      "Transaction PIN has not been created. Please create one first."
    );
  }

  validateTransactionPin(currentPin);
  validateTransactionPin(newPin);

  const validCurrentPin = await bcrypt.compare(
    currentPin,
    user.transaction_pin_hash
  );

  if (!validCurrentPin) {
    throw new Error("Current transaction PIN is incorrect.");
  }

  const isSamePin = await bcrypt.compare(
    newPin,
    user.transaction_pin_hash
  );

  if (isSamePin) {
    throw new Error(
      "Your new PIN must be different from your current PIN."
    );
  }

  const newPinHash = await bcrypt.hash(newPin, 12);

  // Update only if the stored hash still matches the hash that
  // was verified above. This prevents overwriting a concurrent change.
  const saved = await updateTransactionPinIfHashMatches(
    userId,
    user.transaction_pin_hash,
    newPinHash
  );

  if (!saved) {
    throw new Error(
      "Your transaction PIN changed during this request. Please try again."
    );
  }

  return {
    success: true,
    message: "Transaction PIN changed successfully.",
    hasTransactionPin: true,
  };
}

// =========================================================
// VERIFY TRANSACTION PIN
// =========================================================

export async function verifyTransactionPin(
  userId,
  pin
) {
  const user = await getTransactionPinHash(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (!user.transaction_pin_hash) {
    throw new Error(
      "Transaction PIN has not been created."
    );
  }

  if (
    typeof pin !== "string" ||
    !/^\d{4}$/.test(pin)
  ) {
    throw new Error(
      "Transaction PIN must be exactly 4 digits."
    );
  }

  const valid = await bcrypt.compare(
    pin,
    user.transaction_pin_hash
  );

  if (!valid) {
    throw new Error("Incorrect transaction PIN.");
  }

  return {
    success: true,
    message: "Transaction PIN verified.",
  };
}

// =========================================================
// GET SAVED PIN STATUS
// =========================================================

export async function getTransactionPinStatus(userId) {
  const result =
    await getTransactionPinStatusFromRepository(userId);

  if (!result) {
    throw new Error("User not found.");
  }

  return {
    success: true,
    hasTransactionPin:
      result.has_transaction_pin === true,
  };
}