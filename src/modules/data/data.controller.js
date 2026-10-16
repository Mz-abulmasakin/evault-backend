
/**
 * =========================================================
 * eVAULT DATA CONTROLLER
 * =========================================================
 */

import {
  getDataPlans,
  buyData,
} from "./data.service.js";


/**
 * =========================================================
 * UUID CHECK
 * =========================================================
 */

function isValidUuid(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value)
  );
}


/**
 * =========================================================
 * GET AUTHENTICATED USER UUID
 * =========================================================
 *
 * Different parts of an authentication payload can expose
 * the user UUID under different names.
 *
 * We do NOT accept user ID from req.body.
 *
 * Priority:
 *
 *   1. req.user.sub
 *   2. req.user.userId
 *   3. req.user.id
 *   4. req.user.user?.id
 *   5. req.user.user?.userId
 *
 * =========================================================
 */

function getAuthenticatedUserId(
  req
) {
  const user =
    req?.user;

  if (!user) {
    return null;
  }

  const candidates = [
    user.sub,

    user.userId,

    user.id,

    user.user?.id,

    user.user?.userId,

    user.user?.sub,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      isValidUuid(
        candidate
      )
    ) {
      return String(
        candidate
      );
    }
  }

  return null;
}


/**
 * =========================================================
 * COMMON ERROR RESPONSE
 * =========================================================
 */

function sendError(
  res,
  error,
  fallbackMessage
) {
  const status =
    Number(
      error?.status ||
        error?.statusCode ||
        500
    );

  return res.status(
    status >= 400 &&
    status <= 599
      ? status
      : 500
  ).json({
    success:
      false,

    message:
      error?.message ||
      fallbackMessage,

    code:
      error?.code ||
      null,
  });
}


/**
 * =========================================================
 * GET DATA PLANS
 * =========================================================
 *
 * GET /api/v1/data/plans
 *
 * Optional:
 *
 * GET /api/v1/data/plans?network=MTN
 * =========================================================
 */

export async function getDataPlansController(
  req,
  res
) {
  try {
    const network =
      req.query?.network ||
      null;

    const result =
      await getDataPlans({
        network,
      });

    return res.status(
      200
    ).json({
      success:
        true,

      data:
        result,
    });

  } catch (
    error
  ) {
    console.error(
      "DATA PLANS CONTROLLER ERROR:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to load data plans."
    );
  }
}


/**
 * =========================================================
 * PURCHASE DATA
 * =========================================================
 *
 * POST /api/v1/data/purchase
 * =========================================================
 */

export async function purchaseDataController(
  req,
  res
) {
  try {

    /**
     * -----------------------------------------------------
     * GET UUID FROM AUTH TOKEN
     * -----------------------------------------------------
     */

    const userId =
      getAuthenticatedUserId(
        req
      );


    /**
     * -----------------------------------------------------
     * DO NOT CONTINUE WITH A BAD USER ID
     * -----------------------------------------------------
     */

    if (!userId) {
      console.error(
        "DATA PURCHASE AUTH USER ERROR:",
        {
          hasUser:
            Boolean(
              req?.user
            ),

          userKeys:
            req?.user &&
            typeof req.user ===
              "object"
              ? Object.keys(
                  req.user
                )
              : [],

          /*
           * Deliberately do not print the entire JWT/user
           * object.
           */
        }
      );

      const error =
        new Error(
          "Authenticated user ID is missing or invalid."
        );

      error.code =
        "INVALID_AUTH_USER_ID";

      error.status =
        401;

      throw error;
    }


    /**
     * -----------------------------------------------------
     * REQUEST BODY
     * -----------------------------------------------------
     */

    const {
      phoneNumber,

      network,

      dataPlanId,

      /*
       * Backward compatibility with existing frontend.
       */
      planId,

      transactionPin,
    } =
      req.body || {};


    /**
     * -----------------------------------------------------
     * BUY DATA
     * -----------------------------------------------------
     */

    const result =
      await buyData({
        userId,

        phoneNumber,

        network,

        dataPlanId,

        planId,

        transactionPin,
      });


    /**
     * -----------------------------------------------------
     * RESPONSE
     * -----------------------------------------------------
     */

    return res.status(
      200
    ).json({
      success:
        Boolean(
          result?.success
        ),

      data:
        result,
    });

  } catch (
    error
  ) {

    console.error(
      "DATA PURCHASE CONTROLLER ERROR:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to complete data purchase."
    );
  }
}
