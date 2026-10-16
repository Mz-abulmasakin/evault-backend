// src/modules/funding/monnify.auth.service.js

import axios from "axios";

import env from "../../config/env.js";


let accessToken = null;
let tokenExpiry = 0;


/**
 * =========================================================
 * GET MONNIFY ACCESS TOKEN
 * =========================================================
 */
export async function getAccessToken() {

  /**
   * Return cached token
   */
  if (
    accessToken &&
    Date.now() < tokenExpiry
  ) {
    return accessToken;
  }


  const apiKey =
    env.integrations
      ?.monnify
      ?.apiKey;

  const secretKey =
    env.integrations
      ?.monnify
      ?.secretKey;

  const baseUrl =
    env.integrations
      ?.monnify
      ?.baseUrl;


  if (!apiKey) {
    throw new Error(
      "MONNIFY_API_KEY is not configured"
    );
  }

  if (!secretKey) {
    throw new Error(
      "MONNIFY_SECRET_KEY is not configured"
    );
  }

  if (!baseUrl) {
    throw new Error(
      "MONNIFY_BASE_URL is not configured"
    );
  }


  const normalizedBaseUrl =
    baseUrl.replace(
      /\/+$/,
      ""
    );


  const credentials =
    Buffer.from(
      `${apiKey}:${secretKey}`
    ).toString("base64");


  const endpoint =
    `${normalizedBaseUrl}/api/v1/auth/login`;


  const response =
    await axios.post(
      endpoint,
      {},
      {
        headers: {
          Authorization:
            `Basic ${credentials}`,

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
      "Monnify authentication failed"
    );
  }


  const responseBody =
    response.data
      ?.responseBody;


  if (
    !responseBody
      ?.accessToken
  ) {
    throw new Error(
      "Monnify did not return an access token"
    );
  }


  accessToken =
    responseBody.accessToken;


  const expiresIn =
    Number(
      responseBody.expiresIn ||
      3600
    );


  tokenExpiry =
    Date.now() +
    Math.max(
      expiresIn - 60,
      30
    ) *
    1000;


  return accessToken;
}