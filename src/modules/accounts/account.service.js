import { findAccountByUserId } from "./account.repository.js";

export async function getMyAccount(userId) {
  const account = await findAccountByUserId(userId);

  if (!account) {
    throw new Error("Account not found");
  }

  return account;
}