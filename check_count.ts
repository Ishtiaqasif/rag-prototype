import * as dotenv from "dotenv";
dotenv.config();
import { Client } from "pg";

async function checkCount() {
    const client = new Client({
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || "5432"),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
    });

    await client.connect();
    const res = await client.query("SELECT COUNT(*) FROM cv_documents");
    console.log(`Current Count: ${res.rows[0].count}`);
    await client.end();
}

checkCount().catch(console.error);
