// src/modules/funding/monnify.account.service.js

import axios from "axios";

import env from "../../config/env.js";

import {
  getAccessToken,
} from "./monnify.auth.service.js";


/**
 * =========================================================
 * CREATE MONNIFY DEDICATED ACCOUNT
 * =========================================================
 */
export async function createReservedAccount(
  user
) {

  if (!user) {
    throw new Error(
      "User is required"
    );
  }

  const fullName =
    user.full_name ||
    user.fullName;

  if (!fullName) {
    throw new Error(
      "User full name is missing"
    );
  }

  if (!user.email) {
    throw new Error(
      "User email is missing"
    );
  }

  const accountReference =
    `EVAULT-${user.id}`;

  const baseUrl =
    env.integrations
      ?.monnify
      ?.baseUrl;

  if (!baseUrl) {
    throw new Error(
      "MONNIFY_BASE_URL is not configured"
    );
  }

  const token =
    await getAccessToken();

  const endpoint =
    `${baseUrl.replace(/\/+$/, "")}/api/v2/bank-transfer/reserved-accounts`;

  console.log(
    "Creating Monnify Reserved Account"
  );

  console.log(
    "Account Reference:",
    accountReference
  );

  const response =
    await axios.post(
      endpoint,

      {
        accountReference,

        accountName:
          fullName,

        currencyCode:
          "NGN",

        contractCode:
          env.integrations
            .monnify
            .contractCode,

        customerEmail:
          user.email,

        customerName:
          fullName,

        getAllAvailableBanks:
          false,

        preferredBanks: [
          "035",
        ],
      },

      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        timeout: 30000,
      }
    );

  if (
    !response.data
      ?.requestSuccessful
  ) {

    throw new Error(
      response.data
        ?.responseMessage ||
      "Monnify account creation failed"
    );
  }

  const account =
    response.data
      ?.responseBody;

  if (!account) {
    throw new Error(
      "Monnify returned an empty account response"
    );
  }

  console.log(
    "Monnify Reserved Account Created:",
    account
  );

  return account;
}