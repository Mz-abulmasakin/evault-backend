 // src/config/env.js

import dotenv from "dotenv";

dotenv.config();

const env = {

  /**
   * =======================================================
   * SERVER
   * =======================================================
   */

  server: {

    port:
      process.env.PORT || 5000,

    nodeEnv:
      process.env.NODE_ENV || "development",

  },


  /**
   * =======================================================
   * DATABASE
   * =======================================================
   */

  database: {

    host:
      process.env.DB_HOST,

    port:
      Number(
        process.env.DB_PORT
      ),

    name:
      process.env.DB_NAME,

    user:
      process.env.DB_USER,

    password:
      process.env.DB_PASSWORD,

    url:
      process.env.DATABASE_URL,

  },


 /**
 * =======================================================
 * JWT
 * =======================================================
 */

jwt: {

  /**
   * -----------------------------------------------------
   * CUSTOMER JWT
   * -----------------------------------------------------
   */

  secret:
    process.env.JWT_SECRET,

  expiresIn:
    process.env.JWT_EXPIRES_IN ||
    "7d",


  /**
   * -----------------------------------------------------
   * ADMIN JWT
   * -----------------------------------------------------
   */

  adminSecret:
    process.env.ADMIN_JWT_SECRET,

  adminExpiresIn:
    process.env.ADMIN_JWT_EXPIRES_IN ||
    "8h",

},
  /**
   * =======================================================
   * STORAGE
   * =======================================================
   */

  storage: {

    uploadPath:
      process.env.UPLOAD_PATH ||
      "uploads",

  },


  /**
   * =======================================================
   * INTEGRATIONS
   * =======================================================
   */

  integrations: {

    /**
     * -----------------------------------------------------
     * MONNIFY
     * -----------------------------------------------------
     */

    monnify: {

      apiKey:
        process.env.MONNIFY_API_KEY,

      secretKey:
        process.env.MONNIFY_SECRET_KEY,

      contractCode:
        process.env.MONNIFY_CONTRACT_CODE,

      baseUrl:
        process.env.MONNIFY_BASE_URL,

    },


    /**
     * -----------------------------------------------------
     * ALRAHUZDATA
     * -----------------------------------------------------
     */

    alrahuzdata: {

      apiKey:
        process.env.ALRAHUZDATA_API_KEY,

      baseUrl:
        process.env.ALRAHUZDATA_BASE_URL ||
        "https://alrahuzdata.com.ng",

    },

instantipe: {
  baseUrl:
    process.env.INSTANTIPE_BASE_URL ||
    "https://instantipe.com.ng",

  apiKey:
    process.env.INSTANTIPE_API_KEY ||
    null,
},
    /**
     * -----------------------------------------------------
     * SMS
     * -----------------------------------------------------
     */

    sms: {

      apiKey:
        process.env.SMS_API_KEY,

    },


    /**
     * -----------------------------------------------------
     * EMAIL
     * -----------------------------------------------------
     */

    email: {

      apiKey:
        process.env.EMAIL_API_KEY,

    },

  },

};


export default env;