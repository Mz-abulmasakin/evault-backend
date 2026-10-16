
import crypto from "crypto";
import pool from "../../config/database.js";

export async function findUserForPasswordRecovery({
  phoneNumber,
  identityType,
  identityNumber,
}) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  const localPhone = digits.startsWith("234")
    ? `0${digits.slice(3)}`
    : digits;

  const internationalPhone = `234${localPhone.slice(1)}`;
  const type = String(identityType || "").toUpperCase();

  const result = await pool.query(
    `
      SELECT u.id
      FROM public.users u
      INNER JOIN public.identity_verifications iv
        ON iv.user_id = u.id
      WHERE regexp_replace(
              COALESCE(u.phone_number, ''),
              '[^0-9]',
              '',
              'g'
            ) IN ($1, $2)
        AND (
          (
            $3 = 'NIN'
            AND iv.nin = $4
            AND iv.nin_verified IS TRUE
          )
          OR
          (
            $3 = 'BVN'
            AND iv.bvn = $4
            AND iv.bvn_verified IS TRUE
          )
        )
      LIMIT 1
    `,
    [
      localPhone,
      internationalPhone,
      type,
      String(identityNumber || "").trim(),
    ]
  );

  return result.rows[0] || null;
}

/**
 * Create a short-lived recovery token.
 * Only its hash is stored in PostgreSQL.
 */
export async function createPasswordResetLink({
  id,
  userId,
  tokenHash,
  expiresAt,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [String(userId)]
    );

    const rateResult = await client.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE created_at >
              CURRENT_TIMESTAMP - INTERVAL '1 minute'
          )::INTEGER AS last_minute,
          COUNT(*)::INTEGER AS last_hour
        FROM public.password_reset_links
        WHERE user_id = $1
          AND created_at >
            CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `,
      [userId]
    );

    const rate = rateResult.rows[0];

    if (
      Number(rate.last_minute) > 0 ||
      Number(rate.last_hour) >= 5
    ) {
      await client.query("ROLLBACK");
      return false;
    }

    // Invalidate previously issued tokens for this account.
    await client.query(
      `
        UPDATE public.password_reset_links
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [userId]
    );

    await client.query(
      `
        INSERT INTO public.password_reset_links (
          id,
          user_id,
          token_hash,
          expires_at
        )
        VALUES ($1, $2, $3, $4)
      `,
      [id, userId, tokenHash, expiresAt]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function completePasswordResetByToken({
  tokenHash,
  passwordHash,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT id, user_id
        FROM public.password_reset_links
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        FOR UPDATE
      `,
      [tokenHash]
    );

    const reset = result.rows[0];

    if (!reset) {
      await client.query("ROLLBACK");
      return false;
    }

    const updated = await client.query(
      `
        UPDATE public.users
        SET password_hash = $1
        WHERE id = $2
        RETURNING id
      `,
      [passwordHash, reset.user_id]
    );

    if (updated.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }

    // A successful reset invalidates every outstanding token
    // belonging to this account.
    await client.query(
      `
        UPDATE public.password_reset_links
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [reset.user_id]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function isPasswordResetTokenValid(tokenHash) {
  const result = await pool.query(
    `
      SELECT 1
      FROM public.password_reset_links
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [tokenHash]
  );

  return Boolean(result.rows[0]);
}
