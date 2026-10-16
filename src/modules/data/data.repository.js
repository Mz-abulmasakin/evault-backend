// src/modules/data/data.repository.js

import db from "../../config/database.js";

/*
|--------------------------------------------------------------------------
| DATA PROVIDER
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This repository does NOT calculate the 2% markup.
|
| The service layer is responsible for:
|
|   NetworkDataSub provider price
|              +
|          2% markup
|              =
|       eVault customer price
|
| Whatever customer price is passed into `amount` is what is stored.
|
|--------------------------------------------------------------------------
*/

const DEFAULT_PROVIDER = "NETWORKDATASUB";

/*
|--------------------------------------------------------------------------
| CREATE DATA PLAN
|--------------------------------------------------------------------------
*/

export async function createDataPlan(
  data,
  client = db
) {
  const {
    providerPlanId,
    network,
    planType,
    amount,
    customerPrice,
    dataSize,
    validity,
    provider = DEFAULT_PROVIDER,
    metadata = {},
  } = data;

  /*
   * `customerPrice` is supported so the caller can explicitly
   * identify that the stored amount is the eVault selling price.
   *
   * If it is not supplied, we fall back to `amount` for
   * compatibility with the existing code.
   */
  const finalAmount =
    customerPrice !== undefined &&
    customerPrice !== null
      ? customerPrice
      : amount;

  if (
    providerPlanId === undefined ||
    providerPlanId === null
  ) {
    throw new Error(
      "providerPlanId is required."
    );
  }

  if (
    finalAmount === undefined ||
    finalAmount === null
  ) {
    throw new Error(
      "Data plan amount is required."
    );
  }

  const result =
    await client.query(
      `
        INSERT INTO data_plans (
          provider_plan_id,
          network,
          plan_type,
          amount,
          data_size,
          validity,
          provider,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        RETURNING *
      `,
      [
        providerPlanId,
        network
          ? String(network).toUpperCase()
          : null,
        planType,
        finalAmount,
        dataSize,
        validity,
        provider,
        JSON.stringify(metadata),
      ]
    );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| FIND PLAN BY PROVIDER ID
|--------------------------------------------------------------------------
|
| NetworkDataSub's plan ID is stored in:
|
|   provider_plan_id
|
|--------------------------------------------------------------------------
*/

export async function findDataPlanByProviderId(
  providerPlanId,
  client = db
) {
  const result =
    await client.query(
      `
        SELECT
          id,
          provider_plan_id,
          provider_plan_id AS data_plan_id,
          network,
          plan_type,
          amount,
          amount AS price,
          data_size,
          validity,
          provider,
          metadata,
          is_active,
          created_at,
          updated_at
        FROM data_plans
        WHERE provider_plan_id = $1
        LIMIT 1
      `,
      [providerPlanId]
    );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| FIND PLAN BY INTERNAL ID
|--------------------------------------------------------------------------
*/

export async function findDataPlanById(
  id,
  client = db
) {
  const result =
    await client.query(
      `
        SELECT
          id,
          provider_plan_id,
          provider_plan_id AS data_plan_id,
          network,
          plan_type,
          amount,
          amount AS price,
          data_size,
          validity,
          provider,
          metadata,
          is_active,
          created_at,
          updated_at
        FROM data_plans
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| GET ALL ACTIVE DATA PLANS
|--------------------------------------------------------------------------
|
| `amount` is the eVault customer price.
|
| `price` is returned as an alias for frontend compatibility.
|
| `data_plan_id` is the NetworkDataSub/provider plan ID.
|
|--------------------------------------------------------------------------
*/

export async function findAllDataPlans(
  client = db
) {
  const result =
    await client.query(
      `
        SELECT
          id,

          provider_plan_id,

          provider_plan_id AS data_plan_id,

          network,

          plan_type,

          amount,

          amount AS price,

          data_size,

          validity,

          provider,

          metadata

        FROM data_plans

        WHERE is_active = true

        ORDER BY
          CASE
            WHEN UPPER(network) = 'MTN'
              THEN 1

            WHEN UPPER(network) = 'AIRTEL'
              THEN 2

            WHEN UPPER(network) = 'GLO'
              THEN 3

            WHEN UPPER(network) = '9MOBILE'
              THEN 4

            ELSE 5
          END,

          amount ASC
      `
    );

  return result.rows;
}


/*
|--------------------------------------------------------------------------
| GET ACTIVE PLANS BY NETWORK
|--------------------------------------------------------------------------
*/

export async function findPlansByNetwork(
  network,
  client = db
) {
  const normalizedNetwork =
    String(
      network || ""
    )
      .trim()
      .toUpperCase();

  const result =
    await client.query(
      `
        SELECT
          id,

          provider_plan_id,

          provider_plan_id AS data_plan_id,

          network,

          plan_type,

          amount,

          amount AS price,

          data_size,

          validity,

          provider,

          metadata

        FROM data_plans

        WHERE UPPER(network) = $1

          AND is_active = true

        ORDER BY
          amount ASC
      `,
      [normalizedNetwork]
    );

  return result.rows;
}


/*
|--------------------------------------------------------------------------
| UPDATE DATA PLAN STATUS
|--------------------------------------------------------------------------
*/

export async function updateDataPlanStatus(
  providerPlanId,
  isActive,
  client = db
) {
  const result =
    await client.query(
      `
        UPDATE data_plans
        SET
          is_active = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE provider_plan_id = $1
        RETURNING *
      `,
      [
        providerPlanId,
        Boolean(isActive),
      ]
    );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| UPDATE DATA PLAN
|--------------------------------------------------------------------------
|
| Useful when NetworkDataSub prices/plans are synchronized.
|
| This DOES NOT apply the 2%.
| The caller must pass the final eVault customer price.
|
|--------------------------------------------------------------------------
*/

export async function updateDataPlan(
  providerPlanId,
  data,
  client = db
) {
  const {
    network,
    planType,
    amount,
    customerPrice,
    dataSize,
    validity,
    provider,
    metadata,
  } = data;

  const finalAmount =
    customerPrice !== undefined &&
    customerPrice !== null
      ? customerPrice
      : amount;

  const result =
    await client.query(
      `
        UPDATE data_plans
        SET
          network =
            COALESCE($2, network),

          plan_type =
            COALESCE($3, plan_type),

          amount =
            COALESCE($4, amount),

          data_size =
            COALESCE($5, data_size),

          validity =
            COALESCE($6, validity),

          provider =
            COALESCE($7, provider),

          metadata =
            COALESCE($8, metadata),

          updated_at =
            CURRENT_TIMESTAMP

        WHERE provider_plan_id = $1

        RETURNING *
      `,
      [
        providerPlanId,

        network
          ? String(network).toUpperCase()
          : null,

        planType ?? null,

        finalAmount ?? null,

        dataSize ?? null,

        validity ?? null,

        provider ?? null,

        metadata !== undefined
          ? JSON.stringify(metadata)
          : null,
      ]
    );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| CREATE DATA TRANSACTION
|--------------------------------------------------------------------------
|
| IMPORTANT:
| We continue using the existing transactions table.
|
| We do NOT create a separate data_transactions table.
|
|--------------------------------------------------------------------------
*/

export async function createDataTransaction(
  data,
  client = db
) {
  const {
    walletId,
    reference,
    amount,
    balanceBefore,
    balanceAfter,
    status = "PENDING",
    description = "Data purchase",
    metadata = {},
  } = data;

  const result =
    await client.query(
      `
        INSERT INTO transactions (
          wallet_id,
          reference,
          type,
          amount,
          balance_before,
          balance_after,
          status,
          description,
          metadata
        )
        VALUES (
          $1,
          $2,
          'PAYMENT',
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        RETURNING *
      `,
      [
        walletId,
        reference,
        amount,
        balanceBefore,
        balanceAfter,
        status,
        description,
        JSON.stringify(metadata),
      ]
    );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| FIND DATA TRANSACTION
|--------------------------------------------------------------------------
*/

export async function findDataTransactionByReference(
  reference,
  client = db
) {
  const result =
    await client.query(
      `
        SELECT *
        FROM transactions
        WHERE reference = $1
        LIMIT 1
      `,
      [reference]
    );

  return result.rows[0] || null;
}