import * as dotenv from "dotenv";
dotenv.config();
import { Client } from "pg";
import { Pinecone } from "@pinecone-database/pinecone";

const VECTOR_STORE = process.env.VECTOR_STORE || "pgvector";

async function checkCount() {
    console.log(`Checking count for ${VECTOR_STORE}...`);

    if (VECTOR_STORE === "pgvector") {
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
    } else if (VECTOR_STORE === "pinecone") {
        if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
            console.error("Missing Pinecone details.");
            process.exit(1);
        }
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pc.Index(process.env.PINECONE_INDEX);
        const stats = await index.describeIndexStats();
        console.log(`Current Count (Total Vectors): ${stats.totalRecordCount}`);
    }
}

checkCount().catch(console.error);
