import "dotenv/config";
import bcrypt from "bcrypt";
import readline from "readline";

import db from "../src/config/database.js";

const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS",
  "FINANCE",
  "SUPPORT",
];

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("");
    console.log("==============================================");
    console.log("          EVAULT ADMIN CREATOR");
    console.log("==============================================");
    console.log("");

    const username = await askQuestion(
      rl,
      "Admin username: "
    );

    const email = await askQuestion(
      rl,
      "Admin email: "
    );

    const fullName = await askQuestion(
      rl,
      "Admin full name: "
    );

    const password = await askQuestion(
      rl,
      "Admin password: "
    );

    const roleInput = await askQuestion(
      rl,
      "Admin role [SUPER_ADMIN]: "
    );

    const role =
      roleInput || "SUPER_ADMIN";

    if (!username) {
      throw new Error(
        "Username is required."
      );
    }

    if (!email) {
      throw new Error(
        "Email is required."
      );
    }

    if (!fullName) {
      throw new Error(
        "Full name is required."
      );
    }

    if (!password) {
      throw new Error(
        "Password is required."
      );
    }

    if (password.length < 8) {
      throw new Error(
        "Admin password must be at least 8 characters."
      );
    }

    if (!ADMIN_ROLES.includes(role)) {
      throw new Error(
        `Invalid role. Use one of: ${ADMIN_ROLES.join(", ")}`
      );
    }

    /**
     * Check whether username already exists.
     */
    const usernameCheck =
      await db.query(
        `
        SELECT id
        FROM admin_users
        WHERE LOWER(username) = LOWER($1)
        LIMIT 1
        `,
        [username]
      );

    if (usernameCheck.rows.length > 0) {
      throw new Error(
        "An admin with this username already exists."
      );
    }

    /**
     * Check whether email already exists.
     */
    const emailCheck =
      await db.query(
        `
        SELECT id
        FROM admin_users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        `,
        [email]
      );

    if (emailCheck.rows.length > 0) {
      throw new Error(
        "An admin with this email already exists."
      );
    }

    /**
     * Hash password.
     */
    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    /**
     * Create admin.
     */
    const result =
      await db.query(
        `
        INSERT INTO admin_users
        (
          username,
          email,
          full_name,
          password_hash,
          role,
          status
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          'ACTIVE'
        )
        RETURNING
          id,
          username,
          email,
          full_name,
          role,
          status,
          created_at
        `,
        [
          username,
          email,
          fullName,
          passwordHash,
          role,
        ]
      );

    const admin =
      result.rows[0];

    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      "       ADMIN CREATED SUCCESSFULLY"
    );
    console.log(
      "=============================================="
    );
    console.log("");

    console.log(
      "ID:",
      admin.id
    );

    console.log(
      "Username:",
      admin.username
    );

    console.log(
      "Email:",
      admin.email
    );

    console.log(
      "Name:",
      admin.full_name
    );

    console.log(
      "Role:",
      admin.role
    );

    console.log(
      "Status:",
      admin.status
    );

    console.log("");

  } catch (error) {
    console.error("");
    console.error(
      "Admin creation failed:"
    );
    console.error(
      error.message
    );
    console.error("");

    process.exitCode = 1;

  } finally {
    rl.close();

    await db.end();
  }
}

main();