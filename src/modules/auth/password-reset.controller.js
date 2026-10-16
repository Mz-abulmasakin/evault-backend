
import {
  verifyPasswordResetDetails,
  resetPassword as resetPasswordService,
} from "./password-reset.service.js";

function sendError(res, error, fallback) {
  const status = Number(error?.status) || 500;

  return res.status(status).json({
    status: "error",
    message:
      status >= 500
        ? (
            status === 429
              ? error.message
              : fallback
          )
        : error.message,
  });
}

export async function verifyPasswordResetDetailsController(
  req,
  res
) {
  try {
    const result = await verifyPasswordResetDetails({
      phoneNumber: req.body?.phoneNumber,
      identityType: req.body?.identityType,
      identityNumber: req.body?.identityNumber,
    });

    return res.status(200).json({
      status: "success",
      message: result.message,
      data: {
        resetToken: result.resetToken,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to verify the account details."
    );
  }
}

export async function resetPassword(req, res) {
  try {
    const result = await resetPasswordService({
      resetToken: req.body?.resetToken,
      newPassword: req.body?.newPassword,
      confirmPassword: req.body?.confirmPassword,
    });

    return res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to reset the password."
    );
  }
}
