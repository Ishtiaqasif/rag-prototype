import * as dotenv from "dotenv";
dotenv.config();
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { OllamaEmbeddings } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Pool, PoolConfig } from "pg";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data/cvs");
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";

/**
 * Extracts the first email found in the text.
 */
function extractEmail(text: string): string | null {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailRegex);
    return match ? match[0].toLowerCase() : null;
}

/**
 * Generates a consistent UUID-like ID for a document chunk.
 */
function generateId(email: string, content: string, index: number): string {
    const hash = crypto.createHash("sha256").update(`${email}:${content}:${index}`).digest("hex");
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        hash.substring(12, 16),
        hash.substring(16, 20),
        hash.substring(20, 32)
    ].join("-");
}

async function main() {
    // Check for PG credentials
    if (!process.env.PG_HOST || !process.env.PG_USER || !process.env.PG_PASSWORD || !process.env.PG_DATABASE) {
        console.error("Missing PostgreSQL connection details in .env file.");
        process.exit(1);
    }

    const pgConfig: PoolConfig = {
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || "5432"),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
    };

    const pool = new Pool(pgConfig);

    console.log("Initializing Embeddings...");
    const embeddings = new OllamaEmbeddings({ model: EMBEDDING_MODEL });

    const vectorStore = await PGVectorStore.initialize(embeddings, {
        postgresConnectionOptions: pgConfig,
        tableName: "cv_documents",
        columns: {
            idColumnName: "id",
            vectorColumnName: "embedding",
            contentColumnName: "text",
            metadataColumnName: "metadata",
        },
    });

    // --- Optional Cleanup of legacy data (without emails) ---
    console.log("Running legacy data cleanup (removing records without emails)...");
    await pool.query("DELETE FROM cv_documents WHERE metadata->>'email' IS NULL");

    console.log("Loading files from:", DATA_DIR);
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".txt") || f.endsWith(".pdf"));

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10000,
        chunkOverlap: 0,
    });

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        console.log(`\nProcessing: ${file}`);

        const loader = file.endsWith(".pdf") ? new PDFLoader(filePath) : new TextLoader(filePath);
        const docs = await loader.load();
        const fullContent = docs.map(d => d.pageContent).join("\n");
        const contentHash = crypto.createHash("sha256").update(fullContent).digest("hex");

        const email = extractEmail(fullContent);
        if (!email) {
            console.warn(`Could not find email in ${file}. Skipping.`);
            continue;
        }

        // Check if we already have this email with the same content hash
        const existingDocs = await pool.query(
            "SELECT id FROM cv_documents WHERE metadata->>'email' = $1 AND metadata->>'contentHash' = $2 LIMIT 1",
            [email, contentHash]
        );

        if (existingDocs.rowCount && existingDocs.rowCount > 0) {
            console.log(`Skipping ${file}: Data for ${email} is already up to date.`);
            continue;
        }

        console.log(`Changes detected for ${email}. Updating...`);

        // Delete existing records for this email
        await pool.query(
            "DELETE FROM cv_documents WHERE metadata->>'email' = $1",
            [email]
        );

        const splitDocs = await splitter.splitDocuments(docs);

        // Add metadata to each chunk
        splitDocs.forEach(doc => {
            doc.metadata.email = email;
            doc.metadata.contentHash = contentHash;
            doc.metadata.source = file;
        });

        const ids = splitDocs.map((doc, i) => generateId(email, doc.pageContent, i));
        await vectorStore.addDocuments(splitDocs, { ids });
        console.log(`Ingested ${splitDocs.length} chunks for ${email}.`);
    }

    console.log("\nIngestion process complete!");
    await pool.end();
    process.exit(0);
}

main().catch((e) => {
    console.error("Ingestion Failed:");
    console.error(e);
    process.exit(1);
});
