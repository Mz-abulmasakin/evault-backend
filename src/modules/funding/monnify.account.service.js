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
  if (!user?.id) {
    throw new Error(
      "Authenticated user ID is missing"
    );
  }

  // -------------------------------------------------------
  // 1. FETCH REGISTERED USER DETAILS
  // -------------------------------------------------------

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
      "Registered full name is missing"
    );
  }

  if (!email) {
    throw new Error(
      "Registered email is missing"
    );
  }

  // -------------------------------------------------------
  // 2. FETCH SAVED BVN / NIN
  // -------------------------------------------------------

  const identityResult = await db.query(
    `
      SELECT
        bvn,
        nin
      FROM identity_verifications
      WHERE user_id = $1
      LIMIT 1
    `,
    [registeredUser.id]
  );

  const identity = identityResult.rows[0] || {};

  const savedBvn = String(
    identity.bvn || ""
  ).trim();

  const savedNin = String(
    identity.nin || ""
  ).trim();

  // Accept either identity number independently.
  const bvn = /^\d{11}$/.test(savedBvn)
    ? savedBvn
    : "";

  const nin = /^\d{11}$/.test(savedNin)
    ? savedNin
    : "";

  if (!bvn && !nin) {
    throw new Error(
      "BVN or NIN is required. Save a valid 11-digit NIN or BVN in your eVault identity profile before generating your dedicated account."
    );
  }

  // -------------------------------------------------------
  // 3. VALIDATE MONNIFY CONFIGURATION
  // -------------------------------------------------------

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

  // -------------------------------------------------------
  // 4. OBTAIN ACCESS TOKEN
  // -------------------------------------------------------

  const token = await getAccessToken();

  const endpoint =
    `${baseUrl}/api/v2/bank-transfer/reserved-accounts`;

  const accountReference =
    `EVAULT-${registeredUser.id}`;

  // -------------------------------------------------------
  // 5. BUILD MONNIFY REQUEST
  // -------------------------------------------------------

  const payload = {
    accountReference,

    accountName: fullName,

    currencyCode: "NGN",

    contractCode: monnify.contractCode,

    customerEmail: email,

    customerName: fullName,

    getAllAvailableBanks: false,

    preferredBanks: ["035"],
  };

  // Include available identity fields.
  // NIN alone is sufficient; BVN is not mandatory
  // when a valid NIN is supplied.

  if (bvn) {
    payload.bvn = bvn;
  }

  if (nin) {
    payload.nin = nin;
  }

  console.log(
    "Creating Monnify Reserved Account:",
    {
      userId: registeredUser.id,
      accountReference,
      hasBvn: Boolean(bvn),
      hasNin: Boolean(nin),
    }
  );

  // -------------------------------------------------------
  // 6. CREATE RESERVED ACCOUNT
  // -------------------------------------------------------

  const response = await axios.post(
    endpoint,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },

      timeout: 30000,
    }
  );

  // -------------------------------------------------------
  // 7. VALIDATE RESPONSE
  // -------------------------------------------------------

  if (!response.data?.requestSuccessful) {
    throw new Error(
      response.data?.responseMessage ||
      "Monnify account creation failed"
    );
  }

  const account =
    response.data?.responseBody;

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