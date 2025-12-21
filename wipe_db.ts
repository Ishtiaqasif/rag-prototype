import * as dotenv from "dotenv";
dotenv.config();
import { Client } from "pg";

async function wipe() {
    const client = new Client({
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || "5432"),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
    });

    await client.connect();
    await client.query("TRUNCATE TABLE cv_documents");
    console.log("Table 'cv_documents' truncated.");
    await client.end();
}

wipe().catch(console.error);
