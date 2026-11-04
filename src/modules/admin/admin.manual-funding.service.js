
import { manuallyFundUser } from "./admin.manual-funding.repository.js";

export async function manualFundCustomer(userId, input, admin) {
  const rawAmount = String(input?.amount ?? "").trim();

  // Only accept positive amounts with up to two decimal places.
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount)) {
    const error = new Error(
      "Enter a valid funding amount with no more than two decimal places."
    );
    error.statusCode = 400;
    throw error;
  }

  if (Number(rawAmount) <= 0 || !Number.isFinite(Number(rawAmount))) {
    const error = new Error("Funding amount must be greater than zero.");
    error.statusCode = 400;
    throw error;
  }

  const amount = Number(rawAmount).toFixed(2);

  return manuallyFundUser(userId, amount, admin);
}
