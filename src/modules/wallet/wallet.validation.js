// src/modules/wallet/wallet.validation.js

export function validateTransfer(data) {
  const {
    recipientWalletNumber,
    amount,
    narration,
    pin,
  } = data;

  if (!recipientWalletNumber?.trim()) {
    throw new Error("Recipient wallet number is required.");
  }

  if (!/^\d+$/.test(recipientWalletNumber)) {
    throw new Error("Invalid wallet number.");
  }

  if (!amount) {
    throw new Error("Amount is required.");
  }

  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    throw new Error("Amount must be a valid number.");
  }

  if (numericAmount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  if (numericAmount < 100) {
    throw new Error("Minimum transfer amount is ₦100.");
  }

  if (numericAmount > 10000000) {
    throw new Error("Transfer amount exceeds the allowed limit.");
  }

  if (!pin) {
    throw new Error("Transaction PIN is required.");
  }

  if (!/^\d{4}$/.test(pin)) {
    throw new Error("Transaction PIN must be exactly 4 digits.");
  }

  if (narration && narration.length > 100) {
    throw new Error("Narration cannot exceed 100 characters.");
  }

  return {
    recipientWalletNumber,
    amount: numericAmount,
    narration: narration?.trim() || "",
    pin,
  };
}