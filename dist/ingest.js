"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const text_1 = require("@langchain/classic/document_loaders/fs/text");
const pdf_1 = require("@langchain/community/document_loaders/fs/pdf");
const text_splitter_1 = require("@langchain/classic/text_splitter");
const ollama_1 = require("@langchain/ollama");
const pgvector_1 = require("@langchain/community/vectorstores/pgvector");
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const DATA_DIR = path_1.default.join(process.cwd(), "data/cvs");
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";
/**
 * Extracts the first email found in the text.
 */
function extractEmail(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailRegex);
    return match ? match[0].toLowerCase() : null;
}
/**
 * Generates a consistent UUID-like ID for a document chunk.
 */
function generateId(email, content, index) {
    const hash = crypto_1.default.createHash("sha256").update(`${email}:${content}:${index}`).digest("hex");
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
    const pgConfig = {
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || "5432"),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
    };
    const pool = new pg_1.Pool(pgConfig);
    console.log("Initializing Embeddings...");
    const embeddings = new ollama_1.OllamaEmbeddings({ model: EMBEDDING_MODEL });
    const vectorStore = await pgvector_1.PGVectorStore.initialize(embeddings, {
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
    const files = fs_1.default.readdirSync(DATA_DIR).filter(f => f.endsWith(".txt") || f.endsWith(".pdf"));
    const splitter = new text_splitter_1.RecursiveCharacterTextSplitter({
        chunkSize: 10000,
        chunkOverlap: 0,
    });
    for (const file of files) {
        const filePath = path_1.default.join(DATA_DIR, file);
        console.log(`\nProcessing: ${file}`);
        const loader = file.endsWith(".pdf") ? new pdf_1.PDFLoader(filePath) : new text_1.TextLoader(filePath);
        const docs = await loader.load();
        const fullContent = docs.map(d => d.pageContent).join("\n");
        const contentHash = crypto_1.default.createHash("sha256").update(fullContent).digest("hex");
        const email = extractEmail(fullContent);
        if (!email) {
            console.warn(`Could not find email in ${file}. Skipping.`);
            continue;
        }
        // Check if we already have this email with the same content hash
        const existingDocs = await pool.query("SELECT id FROM cv_documents WHERE metadata->>'email' = $1 AND metadata->>'contentHash' = $2 LIMIT 1", [email, contentHash]);
        if (existingDocs.rowCount && existingDocs.rowCount > 0) {
            console.log(`Skipping ${file}: Data for ${email} is already up to date.`);
            continue;
        }
        console.log(`Changes detected for ${email}. Updating...`);
        // Delete existing records for this email
        await pool.query("DELETE FROM cv_documents WHERE metadata->>'email' = $1", [email]);
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
