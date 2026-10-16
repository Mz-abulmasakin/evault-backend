import pg from "pg";
import env from "./env.js";


const { Pool } = pg;


const pool = new Pool({

    host: env.database.host,

    port: env.database.port,

    database: env.database.name,

    user: env.database.user,

    password: env.database.password,

});


pool.on("connect", () => {
    console.log("PostgreSQL connected successfully");
});


pool.on("error", (error) => {
    console.error("Unexpected database error:", error);
});


export default pool;
