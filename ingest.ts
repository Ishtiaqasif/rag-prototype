import * as dotenv from "dotenv";
dotenv.config();
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { OllamaEmbeddings } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { Pool, PoolConfig } from "pg";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || "data/top100";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3.2:latest";
const VECTOR_STORE = process.env.VECTOR_STORE || "json";
const JSON_STORAGE_PATH = path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");

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
    console.log(`Using Vector Store: ${VECTOR_STORE}`);

    const embeddings = new OllamaEmbeddings({ model: EMBEDDING_MODEL });
    let vectorStore: any;
    let pool: Pool | null = null;
    let pineconeIndex: any = null;

    if (VECTOR_STORE === "pgvector") {
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
        pool = new Pool(pgConfig);
        vectorStore = await PGVectorStore.initialize(embeddings, {
            postgresConnectionOptions: pgConfig,
            tableName: "cv_documents",
            columns: {
                idColumnName: "id",
                vectorColumnName: "embedding",
                contentColumnName: "text",
                metadataColumnName: "metadata",
            },
        });

        console.log("Running legacy data cleanup (removing records without emails)...");
        await pool.query("DELETE FROM cv_documents WHERE metadata->>'email' IS NULL");
    } else if (VECTOR_STORE === "pinecone") {
        if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
            console.error("Missing Pinecone connection details in .env file.");
            process.exit(1);
        }
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        pineconeIndex = pc.Index(process.env.PINECONE_INDEX);
        vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex,
        });
    } else if (VECTOR_STORE === "json") {
        console.log(`JSON Storage initialized at: ${JSON_STORAGE_PATH}`);
        // json mode doesn't need a LangChain vectorStore object for ingestion here,
        // we'll handle saving manually to have full control over the local file.
    } else {
        console.error(`Unsupported VECTOR_STORE: ${VECTOR_STORE}`);
        process.exit(1);
    }

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

        // --- Deduplication Logic ---
        let alreadyUpToDate = false;
        if (VECTOR_STORE === "pgvector" && pool) {
            const existingDocs = await pool.query(
                "SELECT id FROM cv_documents WHERE metadata->>'email' = $1 AND metadata->>'contentHash' = $2 LIMIT 1",
                [email, contentHash]
            );
            if (existingDocs.rowCount && existingDocs.rowCount > 0) alreadyUpToDate = true;
        } else if (VECTOR_STORE === "pinecone" && pineconeIndex) {
            const dummyVector = await embeddings.embedQuery("dummy");
            const queryResponse = await pineconeIndex.query({
                vector: dummyVector,
                filter: {
                    email: { "$eq": email },
                    contentHash: { "$eq": contentHash }
                },
                topK: 1,
                includeMetadata: true
            });
            if (queryResponse.matches && queryResponse.matches.length > 0) alreadyUpToDate = true;
        } else if (VECTOR_STORE === "json") {
            if (fs.existsSync(JSON_STORAGE_PATH)) {
                const data = JSON.parse(fs.readFileSync(JSON_STORAGE_PATH, "utf-8"));
                const existing = data.find((item: any) => item.metadata.email === email && item.metadata.contentHash === contentHash);
                if (existing) alreadyUpToDate = true;
            }
        }

        if (alreadyUpToDate) {
            console.log(`Skipping ${file}: Data for ${email} is already up to date.`);
            continue;
        }

        console.log(`Changes detected for ${email}. Updating...`);

        // --- Deletion Logic ---
        if (VECTOR_STORE === "pgvector" && pool) {
            await pool.query("DELETE FROM cv_documents WHERE metadata->>'email' = $1", [email]);
        } else if (VECTOR_STORE === "pinecone" && pineconeIndex) {
            // Pinecone Serverless does not support delete by filter. 
            // We must query for IDs first, then delete by ID.
            const queryResponse = await pineconeIndex.query({
                vector: await embeddings.embedQuery("dummy"),
                filter: { email: { "$eq": email } },
                topK: 1000,
                includeMetadata: false
            });

            if (queryResponse.matches && queryResponse.matches.length > 0) {
                const idsToDelete = queryResponse.matches.map((m: any) => m.id);
                await pineconeIndex.deleteMany(idsToDelete);
            }
        } else if (VECTOR_STORE === "json") {
            if (fs.existsSync(JSON_STORAGE_PATH)) {
                const data = JSON.parse(fs.readFileSync(JSON_STORAGE_PATH, "utf-8"));
                const filtered = data.filter((item: any) => item.metadata.email !== email);
                fs.writeFileSync(JSON_STORAGE_PATH, JSON.stringify(filtered, null, 2));
            }
        }

        const splitDocs = await splitter.splitDocuments(docs);
        splitDocs.forEach(doc => {
            doc.metadata.email = email;
            doc.metadata.contentHash = contentHash;
            doc.metadata.source = file;
        });

        const ids = splitDocs.map((doc: any, i: number) => generateId(email, doc.pageContent, i));

        if (VECTOR_STORE === "json") {
            const newVectors = await Promise.all(splitDocs.map(async (doc, i) => {
                const vector = await embeddings.embedQuery(doc.pageContent);
                return {
                    id: ids[i],
                    vector,
                    content: doc.pageContent,
                    metadata: doc.metadata
                };
            }));
            const existingData = fs.existsSync(JSON_STORAGE_PATH) ? JSON.parse(fs.readFileSync(JSON_STORAGE_PATH, "utf-8")) : [];
            fs.writeFileSync(JSON_STORAGE_PATH, JSON.stringify([...existingData, ...newVectors], null, 2));
            console.log(`Ingested ${splitDocs.length} chunks into JSON for ${email}.`);
        } else {
            await vectorStore.addDocuments(splitDocs, { ids });
            console.log(`Ingested ${splitDocs.length} chunks for ${email}.`);
        }
    }

    console.log("\nIngestion process complete!");
    if (pool) await pool.end();
    process.exit(0);
}

main().catch((e) => {
    console.error("Ingestion Failed:");
    console.error(e);
    process.exit(1);
});
