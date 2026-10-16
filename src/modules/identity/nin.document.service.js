import axios from "axios";
import { URL } from "url";

import {
  findUserIdentityRequestById,
} from "./identityRequest.repository.js";

/**
 * =========================================================
 * DOWNLOAD NIN DOCUMENT
 * =========================================================
 *
 * GET /api/v1/identity/nin/:id/download
 *
 * Security:
 *
 * 1. JWT authentication is required by the route.
 * 2. Request must belong to authenticated user.
 * 3. Verification must be SUCCESS.
 * 4. Provider document URL must exist.
 * 5. Server downloads the document and streams it.
 *
 * The provider URL is therefore not directly exposed
 * as the application's API response.
 */

export async function downloadNinDocumentController(
  req,
  res
) {
  try {
    const userId =
      req.user?.id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const requestId =
      req.params.id;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message:
          "Verification request ID is required.",
      });
    }

    /**
     * -------------------------------------------------------
     * OWNER CHECK
     * -------------------------------------------------------
     */

    const request =
      await findUserIdentityRequestById(
        requestId,
        userId
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          "Verification request not found.",
      });
    }

    /**
     * -------------------------------------------------------
     * SUCCESS CHECK
     * -------------------------------------------------------
     */

    if (
      request.status !==
      "SUCCESS"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "NIN verification has not completed successfully.",
        status:
          request.status,
        providerStatus:
          request.provider_status,
      });
    }

    /**
     * -------------------------------------------------------
     * DOCUMENT CHECK
     * -------------------------------------------------------
     */

    if (!request.document_url) {
      return res.status(404).json({
        success: false,
        message:
          "NIN verification document is not available yet.",
      });
    }

    /**
     * -------------------------------------------------------
     * EXPIRY CHECK
     * -------------------------------------------------------
     */

    if (
      request.document_expires_at &&
      new Date(
        request.document_expires_at
      ).getTime() <
        Date.now()
    ) {
      return res.status(410).json({
        success: false,
        message:
          "The verification document has expired.",
      });
    }

    /**
     * -------------------------------------------------------
     * VALIDATE URL
     * -------------------------------------------------------
     */

    let documentUrl;

    try {
      documentUrl =
        new URL(
          request.document_url
        );
    } catch {
      return res.status(502).json({
        success: false,
        message:
          "Invalid provider document URL.",
      });
    }

    /**
     * Only HTTP/HTTPS documents are accepted.
     */

    if (
      ![
        "http:",
        "https:",
      ].includes(
        documentUrl.protocol
      )
    ) {
      return res.status(502).json({
        success: false,
        message:
          "Unsupported document URL.",
      });
    }

    /**
     * -------------------------------------------------------
     * FETCH PROVIDER DOCUMENT
     * -------------------------------------------------------
     */

    const providerResponse =
      await axios.get(
        documentUrl.toString(),
        {
          responseType:
            "stream",

          timeout:
            30000,

          maxRedirects:
            5,

          validateStatus:
            (status) =>
              status >= 200 &&
              status < 300,
        }
      );

    /**
     * -------------------------------------------------------
     * CONTENT TYPE
     * -------------------------------------------------------
     */

    const contentType =
      providerResponse.headers[
        "content-type"
      ] ||
      "application/pdf";

    /**
     * -------------------------------------------------------
     * RESPONSE HEADERS
     * -------------------------------------------------------
     */

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Evault-NIN-${request.id}.pdf"`
    );

    if (
      providerResponse.headers[
        "content-length"
      ]
    ) {
      res.setHeader(
        "Content-Length",
        providerResponse.headers[
          "content-length"
        ]
      );
    }

    /**
     * -------------------------------------------------------
     * STREAM
     * -------------------------------------------------------
     */

    providerResponse.data.pipe(
      res
    );

    providerResponse.data.on(
      "error",
      (error) => {
        console.error(
          "[NIN DOCUMENT STREAM]",
          error.message
        );

        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            message:
              "Unable to download verification document.",
          });
        } else {
          res.destroy(error);
        }
      }
    );
  } catch (error) {
    console.error(
      "[NIN DOCUMENT DOWNLOAD]",
      error.message
    );

    if (
      res.headersSent
    ) {
      return res.destroy(
        error
      );
    }

    return res.status(
      error.response?.status ||
        502
    ).json({
      success: false,
      message:
        "Unable to download NIN verification document.",
    });
  }
}