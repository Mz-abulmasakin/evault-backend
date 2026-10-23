
 // src/modules/funding/monnify.account.service.js

import axios from "axios";

import db from "../../config/database.js";
import env from "../../config/env.js";

import {
  getAccessToken,
} from "./monnify.auth.service.js";

// =========================================================
// CREATE MONNIFY DEDICATED ACCOUNT
// =========================================================

export async function createReservedAccount(user) {
  // 1. Validate the authenticated user.
  if (!user?.id) {
    throw new Error(
      "Authenticated user ID is missing"
    );
  }

  // 2. Fetch the customer's registered details.
  // JWT claims may not contain the customer's full name
  // or email, so retrieve the database record directly.

  const userResult = await db.query(
    `
      SELECT
        id,
        full_name,
        email
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [user.id]
  );

  const registeredUser = userResult.rows[0];

  if (!registeredUser) {
    throw new Error(
      "Registered user record not found"
    );
  }

  // Prefer the registered database values.
  // Retain JWT fallbacks for compatibility with existing callers.
  const fullName = String(
    registeredUser.full_name ||
    user.full_name ||
    user.fullName ||
    ""
  ).trim();

  const email = String(
    registeredUser.email ||
    user.email ||
    ""
  ).trim();

  if (!fullName) {
    throw new Error(
      "Registered full name is missing. Please check the user's database record."
    );
  }

  if (!email) {
    throw new Error(
      "Registered email is missing. Please check the user's database record."
    );
  }

  // 3. Validate Monnify configuration.
  const monnify = env.integrations?.monnify;

  const baseUrl = String(
    monnify?.baseUrl || ""
  ).replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error(
      "MONNIFY_BASE_URL is not configured"
    );
  }

  if (!monnify?.contractCode) {
    throw new Error(
      "MONNIFY_CONTRACT_CODE is not configured"
    );
  }

  // 4. Obtain the Monnify access token.
  const token = await getAccessToken();

  // 5. Build the reserved-account endpoint.
  const endpoint =
    `${baseUrl}/api/v2/bank-transfer/reserved-accounts`;

  const accountReference =
    `EVAULT-${registeredUser.id}`;

  console.log(
    "Creating Monnify Reserved Account:",
    {
      userId: registeredUser.id,
      accountReference,
      hasFullName: Boolean(fullName),
      hasEmail: Boolean(email),
    }
  );

  // 6. Request the dedicated account from Monnify.
  const response = await axios.post(
    endpoint,
    {
      accountReference,

      accountName: fullName,

      currencyCode: "NGN",

      contractCode: monnify.contractCode,

      customerEmail: email,

      customerName: fullName,

      getAllAvailableBanks: false,

      preferredBanks: ["035"],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  // 7. Validate Monnify's response.
  if (!response.data?.requestSuccessful) {
    throw new Error(
      response.data?.responseMessage ||
      "Monnify account creation failed"
    );
  }

  const account = response.data?.responseBody;

  if (!account) {
    throw new Error(
      "Monnify returned an empty account response"
    );
  }

  console.log(
    "Monnify Reserved Account Created:",
    {
      userId: registeredUser.id,
      accountReference,
      accountCount: Array.isArray(account.accounts)
        ? account.accounts.length
        : 0,
    }
  );

  return account;
}
