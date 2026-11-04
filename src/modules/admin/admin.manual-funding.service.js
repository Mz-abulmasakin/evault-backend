
import {
  manuallyFundUser,
  manuallyDeductUser,
} from "./admin.manual-funding.repository.js";

// =========================================================
// VALIDATE FUNDING AMOUNT
// =========================================================

function validateAmount(value, action = "Funding") {
  const rawAmount = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount)) {
    const error = new Error(
      `Enter a valid ${action.toLowerCase()} amount with no more than two decimal places.`
    );
    error.statusCode = 400;
    throw error;
  }

  const numericAmount = Number(rawAmount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    const error = new Error(
      `${action} amount must be greater than zero.`
    );
    error.statusCode = 400;
    throw error;
  }

  return numericAmount.toFixed(2);
}

// =========================================================
// MANUAL CUSTOMER FUNDING
// =========================================================

export async function manualFundCustomer(userId, input, admin) {
  const amount = validateAmount(input?.amount, "Funding");

  return manuallyFundUser(userId, amount, admin);
}

// =========================================================
// MANUAL CUSTOMER DEDUCTION
// =========================================================

export async function manualDeductCustomer(userId, input, admin) {
  const amount = validateAmount(input?.amount, "Deduction");

  const reason = String(input?.reason ?? "").trim();

  if (reason.length < 3) {
    const error = new Error(
      "Please provide a reason for this wallet deduction."
    );
    error.statusCode = 400;
    throw error;
  }

  if (reason.length > 250) {
    const error = new Error(
      "The deduction reason cannot exceed 250 characters."
    );
    error.statusCode = 400;
    throw error;
  }

  return manuallyDeductUser(
    userId,
    amount,
    admin,
    reason
  );
}
