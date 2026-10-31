// src/modules/admin/admin.management.repository.js

import db from "../../config/database.js";

const USER_SELECT = `
  SELECT
    u.id,
    u.username,
    u.full_name,
    u.email,
    u.phone_number,
    u.status,
    u.email_verified,
    u.phone_verified,
    u.created_at,
    w.id AS wallet_id,
    w.wallet_number,
    w.available_balance,
    w.ledger_balance,
    w.currency,
    w.status AS wallet_status
  FROM users u
  LEFT JOIN wallets w ON w.user_id = u.id
`;

function buildUserFilters({ search, status }) {
  const clauses = ["u.deleted_at IS NULL"];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    const p = `$${values.length}`;
    clauses.push(`(
      u.id::text ILIKE ${p}
      OR COALESCE(u.username, '') ILIKE ${p}
      OR COALESCE(u.full_name, '') ILIKE ${p}
      OR COALESCE(u.email, '') ILIKE ${p}
      OR COALESCE(u.phone_number, '') ILIKE ${p}
    )`);
  }

  if (status) {
    values.push(status);
    clauses.push(`u.status = $${values.length}`);
  }

  return { whereSql: clauses.join(" AND "), values };
}

export async function listAdminUsers({ page, limit, search, status }) {
  const { whereSql, values } = buildUserFilters({ search, status });
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const offset = (page - 1) * limit;

  const [rowsResult, countResult] = await Promise.all([
    db.query(
      `${USER_SELECT}
       WHERE ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...values, limit, offset]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total FROM users u WHERE ${whereSql}`,
      values
    ),
  ]);

  return {
    rows: rowsResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
  };
}

export async function findAdminUserById(userId) {
  const result = await db.query(
    `${USER_SELECT}
     WHERE u.id::text = $1
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [String(userId)]
  );

  const user = result.rows[0];
  if (!user) return null;

  let recentTransactions = [];
  if (user.wallet_id) {
    const transactionsResult = await db.query(
      `SELECT
         id,
         reference,
         type,
         amount,
         balance_before,
         balance_after,
         status,
         description,
         metadata,
         created_at
       FROM transactions
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.wallet_id]
    );
    recentTransactions = transactionsResult.rows;
  }

  return { ...user, recent_transactions: recentTransactions };
}

export async function emailAlreadyUsedByAnotherUser(email, userId) {
  const result = await db.query(
    `SELECT id
     FROM users
     WHERE LOWER(email) = LOWER($1)
       AND id::text <> $2
       AND deleted_at IS NULL
     LIMIT 1`,
    [email, String(userId)]
  );

  return result.rows.length > 0;
}

export async function updateAdminUser(userId, fields) {
  const allowedColumns = {
    fullName: "full_name",
    email: "email",
    phoneNumber: "phone_number",
  };

  const assignments = [];
  const values = [];

  for (const [key, column] of Object.entries(allowedColumns)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      values.push(fields[key]);
      assignments.push(`${column} = $${values.length}`);
    }
  }

  if (assignments.length === 0) return findAdminUserById(userId);

  values.push(String(userId));
  const idParameter = `$${values.length}`;

  const result = await db.query(
    `UPDATE users
     SET ${assignments.join(", ")}
     WHERE id::text = ${idParameter}
       AND deleted_at IS NULL
     RETURNING
       id,
       username,
       full_name,
       email,
       phone_number,
       status,
       email_verified,
       phone_verified,
       created_at`,
    values
  );

  return result.rows[0] || null;
}

function buildTransactionFilters({ search, status, type, dateFrom, dateTo }) {
  const clauses = [];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    const p = `$${values.length}`;
    clauses.push(`(
      t.id::text ILIKE ${p}
      OR COALESCE(t.reference, '') ILIKE ${p}
      OR COALESCE(t.type, '') ILIKE ${p}
      OR COALESCE(t.description, '') ILIKE ${p}
      OR COALESCE(u.username, '') ILIKE ${p}
      OR COALESCE(u.full_name, '') ILIKE ${p}
      OR COALESCE(u.email, '') ILIKE ${p}
      OR COALESCE(u.phone_number, '') ILIKE ${p}
    )`);
  }

  if (status) {
    values.push(status);
    clauses.push(`t.status = $${values.length}`);
  }

  if (type) {
    values.push(type);
    clauses.push(`t.type = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    clauses.push(`t.created_at >= $${values.length}::date`);
  }

  if (dateTo) {
    values.push(dateTo);
    clauses.push(`t.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

const ADMIN_TRANSACTION_SELECT = `
  SELECT
    t.id,
    t.wallet_id,
    t.reference,
    t.type,
    t.amount,
    t.balance_before,
    t.balance_after,
    t.status,
    t.description,
    t.metadata,
    t.created_at,
    t.updated_at,
    u.id AS user_id,
    u.username,
    u.full_name,
    u.email,
    u.phone_number,
    w.wallet_number,
    w.currency
  FROM transactions t
  LEFT JOIN wallets w ON w.id = t.wallet_id
  LEFT JOIN users u ON u.id = w.user_id
`;

export async function listAdminTransactions({
  page,
  limit,
  search,
  status,
  type,
  dateFrom,
  dateTo,
}) {
  const { whereSql, values } = buildTransactionFilters({
    search,
    status,
    type,
    dateFrom,
    dateTo,
  });

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const offset = (page - 1) * limit;

  const [rowsResult, countResult] = await Promise.all([
    db.query(
      `${ADMIN_TRANSACTION_SELECT}
       ${whereSql}
       ORDER BY t.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...values, limit, offset]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total
       FROM transactions t
       LEFT JOIN wallets w ON w.id = t.wallet_id
       LEFT JOIN users u ON u.id = w.user_id
       ${whereSql}`,
      values
    ),
  ]);

  return {
    rows: rowsResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
  };
}

export async function findAdminTransaction(identifier) {
  const result = await db.query(
    `${ADMIN_TRANSACTION_SELECT}
     WHERE t.id::text = $1 OR t.reference = $1
     ORDER BY t.created_at DESC
     LIMIT 1`,
    [String(identifier)]
  );

  return result.rows[0] || null;
}
