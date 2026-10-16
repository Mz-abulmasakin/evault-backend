
import bcrypt from "bcrypt";
import crypto from "crypto";

import {
  findUserForPasswordRecovery,
  createPasswordResetLink,
  completePasswordResetByToken,
} from "./password-reset.repository.js";

function serviceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * Verify registered phone + NIN/BVN.
 * Return a one-time reset token only for a matching account.
 */
export async function verifyPasswordResetDetails({
  phoneNumber,
  identityType,
  identityNumber,
}) {
  const phone = String(phoneNumber || "").trim();
  const type = String(identityType || "").trim().toUpperCase();
  const number = String(identityNumber || "").trim();

  if (!/^(\+?234|0)\d{10}$/.test(phone.replace(/\s/g, ""))) {
    throw serviceError(
      "Enter a valid Nigerian phone number."
    );
  }

  if (!["NIN", "BVN"].includes(type)) {
    throw serviceError("Choose NIN or BVN.");
  }

  if (!/^\d{11}$/.test(number)) {
    throw serviceError(
      `${type} must contain exactly 11 digits.`
    );
  }

  const user = await findUserForPasswordRecovery({
    phoneNumber: phone,
    identityType: type,
    identityNumber: number,
  });

  if (!user) {
    throw serviceError(
      "The phone number and identity details could not be verified."
    );
  }

  const resetToken = crypto
    .randomBytes(32)
    .toString("base64url");

  const tokenHash = hashToken(resetToken);

  const saved = await createPasswordResetLink({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  if (!saved) {
    throw serviceError(
      "Too many recovery attempts. Please try again later.",
      429
    );
  }

  return {
    resetToken,
    message: "Account details verified.",
  };
}

/**
 * Consume a valid one-time token and update the bcrypt hash.
 */
export async function resetPassword({
  resetToken,
  newPassword,
  confirmPassword,
}) {
  if (typeof newPassword !== "string") {
    throw serviceError("Enter a new password.");
  }

  if (
    newPassword.length < 8 ||
    Buffer.byteLength(newPassword, "utf8") > 72
  ) {
    throw serviceError(
      "Password must contain at least 8 characters and no more than 72 UTF-8 bytes."
    );
  }

  if (newPassword !== confirmPassword) {
    throw serviceError("The passwords do not match.");
  }

  const token = String(resetToken || "");

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw serviceError(
      "Your recovery session is invalid or expired. Start again."
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const completed = await completePasswordResetByToken({
    tokenHash: hashToken(token),
    passwordHash,
  });

  if (!completed) {
    throw serviceError(
      "Your recovery session is expired or has already been used. Start again."
    );
  }

  return {
    message: "Password updated successfully. You can now log in.",
  };
}
