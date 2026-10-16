import db from "../../config/database.js";


export async function findAccountByUserId(userId){

const result = await db.query(
`
SELECT
id,
account_number,
account_name,
balance,
currency,
status

FROM accounts

WHERE user_id=$1
`,
[userId]
);


return result.rows[0];

}