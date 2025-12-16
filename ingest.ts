import * as dotenv from "dotenv";
dotenv.config();
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const VECTOR_STORE_PATH = path.join(process.cwd(), process.env.LANCEDB_URI || "data", "vectors.json");
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";

async function main() {
    console.log("Loading documents from:", DATA_DIR);
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".txt") || f.endsWith(".pdf"));

    if (files.length === 0) {
        console.log("No .txt files found in data directory.");
        return;
    }

    const documents = [];
    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const loader = file.endsWith(".pdf")
            ? new PDFLoader(filePath)
            : new TextLoader(filePath);
        const docs = await loader.load();
        documents.push(...docs);
    }

    console.log(`Loaded ${documents.length} documents.`);

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
    });

    const splitDocs = await splitter.splitDocuments(documents);
    console.log(`Split into ${splitDocs.length} chunks.`);

    console.log(`Initializing Embeddings (Ollama: ${EMBEDDING_MODEL})...`);
    const embeddings = new OllamaEmbeddings({
        model: EMBEDDING_MODEL,
    });

    console.log("Creating MemoryVectorStore...");
    const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);

    // Serialization
    console.log(`Saving vectors to ${VECTOR_STORE_PATH}...`);
    const vectors = vectorStore.memoryVectors;
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(vectors));

    console.log("Ingestion complete!");
}

main().catch((e) => {
    console.error("Ingestion Failed:");
    console.error(e);
    process.exit(1);
});
