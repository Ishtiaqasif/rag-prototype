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
const memory_1 = require("@langchain/classic/vectorstores/memory");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DATA_DIR = path_1.default.join(process.cwd(), "data");
const VECTOR_STORE_PATH = path_1.default.join(process.cwd(), process.env.LANCEDB_URI || "data", "vectors.json");
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";
async function main() {
    console.log("Loading documents from:", DATA_DIR);
    const files = fs_1.default.readdirSync(DATA_DIR).filter(f => f.endsWith(".txt") || f.endsWith(".pdf"));
    if (files.length === 0) {
        console.log("No .txt files found in data directory.");
        return;
    }
    const documents = [];
    for (const file of files) {
        const filePath = path_1.default.join(DATA_DIR, file);
        const loader = file.endsWith(".pdf")
            ? new pdf_1.PDFLoader(filePath)
            : new text_1.TextLoader(filePath);
        const docs = await loader.load();
        documents.push(...docs);
    }
    console.log(`Loaded ${documents.length} documents.`);
    const splitter = new text_splitter_1.RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
    });
    const splitDocs = await splitter.splitDocuments(documents);
    console.log(`Split into ${splitDocs.length} chunks.`);
    console.log(`Initializing Embeddings (Ollama: ${EMBEDDING_MODEL})...`);
    const embeddings = new ollama_1.OllamaEmbeddings({
        model: EMBEDDING_MODEL,
    });
    console.log("Creating MemoryVectorStore...");
    const vectorStore = await memory_1.MemoryVectorStore.fromDocuments(splitDocs, embeddings);
    // Serialization
    console.log(`Saving vectors to ${VECTOR_STORE_PATH}...`);
    const vectors = vectorStore.memoryVectors;
    fs_1.default.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(vectors));
    console.log("Ingestion complete!");
}
main().catch((e) => {
    console.error("Ingestion Failed:");
    console.error(e);
    process.exit(1);
});
