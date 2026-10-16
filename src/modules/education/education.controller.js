/**
 * =========================================================
 * eVAULT EDUCATION CONTROLLER
 * =========================================================
 */

import {
  getEducationServiceList,
  getEducationServicePrice,
  purchaseEducationPin,
} from "./education.service.js";


/**
 * =========================================================
 * USER ID
 * =========================================================
 */

function getUserId(req) {
  return (
    req?.user?.id ||
    req?.user?.userId ||
    req?.auth?.userId ||
    req?.auth?.id ||
    null
  );
}


/**
 * =========================================================
 * ERROR
 * =========================================================
 */

function sendError(
  res,
  error
) {
  const status =
    Number(
      error?.status ||
        error?.statusCode
    ) || 500;


  const message =
    error?.message ||
    "Education request failed.";


  return res
    .status(status)
    .json({
      success: false,
      message,
      code:
        error?.code ||
        "EDUCATION_REQUEST_FAILED",
    });
}


/**
 * =========================================================
 * SERVICES
 * =========================================================
 */

export async function getEducationServicesController(
  req,
  res
) {
  try {
    const result =
      await getEducationServiceList();

    return res.json(
      {
        success: true,
        ...result,
      }
    );

  } catch (error) {
    console.error(
      "EDUCATION SERVICES CONTROLLER ERROR:",
      error
    );

    return sendError(
      res,
      error
    );
  }
}


/**
 * =========================================================
 * PRICE
 * =========================================================
 */

export async function getEducationPriceController(
  req,
  res
) {
  try {
    const serviceId =
      req.body?.serviceId ??
      req.body?.service_id;

    const quantity =
      req.body?.quantity ??
      1;


    const result =
      await getEducationServicePrice(
        {
          serviceId,
          quantity,
        }
      );


    return res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error(
      "EDUCATION PRICE CONTROLLER ERROR:",
      error
    );

    return sendError(
      res,
      error
    );
  }
}


/**
 * =========================================================
 * PURCHASE
 * =========================================================
 */

export async function purchaseEducationController(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);


    if (!userId) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Authenticated user is required.",
          code:
            "USER_ID_REQUIRED",
        });
    }


    const transactionPin =
      req.body?.transactionPin ??
      req.body?.transaction_pin;


    const serviceId =
      req.body?.serviceId ??
      req.body?.service_id;


    const quantity =
      req.body?.quantity ??
      1;


    const result =
      await purchaseEducationPin(
        {
          userId,
          transactionPin,
          serviceId,
          quantity,
        }
      );


    return res.json(
      {
        success: true,
        ...result,
      }
    );

  } catch (error) {
    console.error(
      "EDUCATION PURCHASE CONTROLLER ERROR:",
      error
    );

    return sendError(
      res,
      error
    );
  }
}


/**
 * =========================================================
 * COMPATIBILITY ALIASES
 * =========================================================
 */

export const getEducationServices =
  getEducationServicesController;

export const getEducationPrice =
  getEducationPriceController;

export const purchaseEducation =
  purchaseEducationController;