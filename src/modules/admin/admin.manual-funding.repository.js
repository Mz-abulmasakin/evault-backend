
import db from "../../config/database.js";
import { randomUUID } from "crypto";

export async function manuallyFundUser(userId, amount, admin = {}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Lock the customer's wallet to prevent concurrent balance changes.
    const walletResult = await client.query(
      `
      SELECT *
      FROM wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    const wallet = walletResult.rows[0];

    if (!wallet) {
      const error = new Error("Customer wallet was not found.");
      error.statusCode = 404;
      throw error;
    }

    if (String(wallet.status).toUpperCase() !== "ACTIVE") {
      const error = new Error("Cannot fund an inactive wallet.");
      error.statusCode = 400;
      throw error;
    }

    // PostgreSQL performs the balance arithmetic.
    const balanceBefore = wallet.available_balance;

    const updatedWalletResult = await client.query(
      `
      UPDATE wallets
      SET
        available_balance = available_balance + $2::numeric,
        ledger_balance = ledger_balance + $2::numeric,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [wallet.id, amount]
    );

    const updatedWallet = updatedWalletResult.rows[0];

    const reference = `MANUAL-${randomUUID()}`;

    const metadata = {
      source: "ADMIN_MANUAL_FUNDING",
      description: "Wallet manually funded by an administrator",
      admin: {
        id: admin.id || null,
        email: admin.email || null,
        role: admin.role || null,
      },
    };

    const transactionResult = await client.query(
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
        'FUNDING',
        $3::numeric,
        $4::numeric,
        $5::numeric,
        'SUCCESS',
        $6,
        $7::jsonb
      )
      RETURNING *
      `,
      [
        wallet.id,
        reference,
        amount,
        balanceBefore,
        updatedWallet.available_balance,
        "Manual wallet funding by administrator",
        JSON.stringify(metadata),
      ]
    );

    await client.query("COMMIT");

    return {
      wallet: updatedWallet,
      transaction: transactionResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
