 // src/modules/funding/funding.controller.js

import crypto from "crypto";

import {
  createUserReservedAccount,
  getUserReservedAccount,
  processFunding,
} from "./funding.service.js";

import env from "../../config/env.js";


// =========================================================
// CREATE RESERVED / DEDICATED FUNDING ACCOUNT
// =========================================================

export async function createReservedAccountController(
  req,
  res
) {

  try {

    const account =
      await createUserReservedAccount(
        req.user
      );


    return res.status(201).json({

      success: true,

      message:
        "Dedicated funding account created successfully",

      data:
        account,

    });

  } catch (error) {

    console.error(
      "Create Reserved Account Error:",
      error.response?.data ||
      error.message
    );


    return res.status(
      error.response?.status || 400
    ).json({

      success: false,

      message:
        error.response?.data?.responseMessage ||
        error.message ||
        "Failed to create dedicated funding account",

    });

  }

}


// =========================================================
// GET RESERVED / DEDICATED FUNDING ACCOUNT
// =========================================================

export async function getReservedAccountController(
  req,
  res
) {

  try {

    const account =
      await getUserReservedAccount(
        req.user.id
      );


    return res.status(200).json({

      success: true,

      data:
        account,

    });

  } catch (error) {

    console.error(
      "Get Reserved Account Error:",
      error.message
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Failed to fetch dedicated funding account",

    });

  }

}


// =========================================================
// VERIFY MONNIFY WEBHOOK SIGNATURE
// =========================================================
//
// Monnify sends:
//
// monnify-signature
//
// The signature is an HMAC-SHA512 hash:
//
// HMAC-SHA512(
//   clientSecret,
//   rawRequestBody
// )
//
// IMPORTANT:
//
// We MUST use req.rawBody.
//
// We must NOT use:
//
// JSON.stringify(req.body)
//
// because Express has already parsed the JSON and
// re-stringifying it can produce a different byte sequence.
//
// Monnify includes the signature on production webhooks.
// Sandbox webhook notifications do not include it.
// =========================================================

function verifyMonnifyWebhook(
  req
) {

  const signature =
    req.headers["monnify-signature"];


  // -------------------------------------------------------
  // GET MONNIFY BASE URL
  // -------------------------------------------------------

  const baseUrl =
    env.integrations
      ?.monnify
      ?.baseUrl ||
    "";


  // -------------------------------------------------------
  // SANDBOX WITHOUT SIGNATURE
  // -------------------------------------------------------
  //
  // Monnify documentation states that sandbox webhook
  // notifications do not include the signature.
  //
  // This keeps our sandbox testing functional.
  // -------------------------------------------------------

  if (!signature) {

    if (
      baseUrl.includes(
        "sandbox.monnify.com"
      )
    ) {

      console.warn(
        "Monnify webhook signature not present. Sandbox request accepted."
      );

      return true;
    }


    console.error(
      "Monnify webhook signature header is missing."
    );

    return false;
  }


  // -------------------------------------------------------
  // CLIENT SECRET
  // -------------------------------------------------------

  const clientSecret =
    env.integrations
      ?.monnify
      ?.secretKey;


  if (!clientSecret) {

    console.error(
      "MONNIFY_SECRET_KEY is not configured."
    );

    return false;
  }


  // -------------------------------------------------------
  // RAW REQUEST BODY
  // -------------------------------------------------------
  //
  // app.js stores this using the `verify` callback of
  // express.json().
  // -------------------------------------------------------

  if (
    !req.rawBody ||
    !Buffer.isBuffer(req.rawBody)
  ) {

    console.error(
      "Monnify webhook raw body is unavailable."
    );

    return false;
  }


  // -------------------------------------------------------
  // COMPUTE HMAC-SHA512
  // -------------------------------------------------------

  const expectedSignature =
    crypto
      .createHmac(
        "sha512",
        clientSecret
      )
      .update(
        req.rawBody
      )
      .digest("hex");


  // -------------------------------------------------------
  // NORMALIZE SIGNATURES
  // -------------------------------------------------------

  const receivedSignature =
    String(signature)
      .trim()
      .toLowerCase();

  const calculatedSignature =
    String(expectedSignature)
      .trim()
      .toLowerCase();


  // -------------------------------------------------------
  // TIMING-SAFE COMPARISON
  // -------------------------------------------------------

  try {

    const expectedBuffer =
      Buffer.from(
        calculatedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        "utf8"
      );


    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {

      return false;

    }


    return crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    );

  } catch (error) {

    console.error(
      "Monnify signature comparison failed:",
      error.message
    );

    return false;
  }

}


// =========================================================
// MONNIFY WEBHOOK
// =========================================================

export async function monnifyWebhook(
  req,
  res
) {

  try {

    console.log(
      "Monnify Webhook Received:",
      JSON.stringify(
        req.body,
        null,
        2
      )
    );


    // -----------------------------------------------------
    // VERIFY SIGNATURE
    // -----------------------------------------------------

    const valid =
      verifyMonnifyWebhook(
        req
      );


    if (!valid) {

      console.error(
        "Invalid Monnify webhook signature"
      );


      return res.status(401).json({

        success: false,

        message:
          "Invalid Monnify webhook signature",

      });

    }


    console.log(
      "Monnify webhook signature verified successfully."
    );


    // -----------------------------------------------------
    // EVENT TYPE
    // -----------------------------------------------------

    const eventType =
      req.body?.eventType;


    // -----------------------------------------------------
    // ONLY PROCESS SUCCESSFUL TRANSACTIONS
    // -----------------------------------------------------

    if (
      eventType &&
      eventType !==
        "SUCCESSFUL_TRANSACTION"
    ) {

      console.log(
        `Ignoring Monnify event: ${eventType}`
      );


      return res.status(200).json({

        success: true,

        message:
          `Event ${eventType} acknowledged`,

      });

    }


    // -----------------------------------------------------
    // PROCESS FUNDING
    // -----------------------------------------------------

    const result =
      await processFunding(
        req.body
      );


    // -----------------------------------------------------
    // SUCCESS
    // -----------------------------------------------------

    return res.status(200).json({

      success: true,

      message:
        "Funding processed successfully",

      data:
        result,

    });


  } catch (error) {

    console.error(
      "Monnify Webhook Error:",
      error.response?.data ||
      error.message
    );


    // -----------------------------------------------------
    // ACKNOWLEDGE WEBHOOK
    // -----------------------------------------------------
    //
    // We currently return 200 during development so
    // Monnify does not continuously retry while we debug.
    // -----------------------------------------------------

    return res.status(200).json({

      success: false,

      message:
        error.message ||
        "Funding processing failed",

    });

  }

}