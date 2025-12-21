import * as dotenv from "dotenv";
dotenv.config();
import { Client } from "pg";
import { Pinecone } from "@pinecone-database/pinecone";

const VECTOR_STORE = process.env.VECTOR_STORE || "pgvector";

async function wipe() {
    console.log(`Wiping data for ${VECTOR_STORE}...`);

    if (VECTOR_STORE === "pgvector") {
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
    } else if (VECTOR_STORE === "pinecone") {
        if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
            console.error("Missing Pinecone details.");
            process.exit(1);
        }
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pc.Index(process.env.PINECONE_INDEX);
        await index.deleteAll();
        console.log("Pinecone index cleared.");
    } else if (VECTOR_STORE === "json") {
        const path = require("path");
        const fs = require("fs");
        const storagePath = path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");
        if (fs.existsSync(storagePath)) {
            fs.unlinkSync(storagePath);
            console.log("JSON storage file deleted.");
        } else {
            console.log("JSON storage file already empty.");
        }
    }
}

wipe().catch(console.error);
