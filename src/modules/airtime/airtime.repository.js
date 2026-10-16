import db from "../../config/database.js";

/**
 * Find an active airtime plan
 */
export async function findAirtimePlan(
  providerPlanId,
  networkId
) {
  const result = await db.query(
    `
    SELECT
      id,
      provider,
      provider_plan_id,
      network_id,
      network_name,
      amount,
      is_active,
      metadata
    FROM airtime_plans
    WHERE provider = 'ALRAHUZ'
      AND provider_plan_id = $1
      AND network_id = $2
      AND is_active = true
    LIMIT 1
    `,
    [providerPlanId, networkId]
  );

  return result.rows[0] || null;
}

/**
 * Get all active airtime plans
 */
export async function findAirtimePlans(networkId = null) {
  let query = `
    SELECT
      id,
      provider,
      provider_plan_id,
      network_id,
      network_name,
      amount,
      is_active,
      metadata
    FROM airtime_plans
    WHERE provider = 'ALRAHUZ'
      AND is_active = true
  `;

  const values = [];

  if (networkId !== null) {
    values.push(networkId);
    query += ` AND network_id = $1`;
  }

  query += `
    ORDER BY network_id ASC, amount ASC
  `;

  const result = await db.query(query, values);

  return result.rows;
}