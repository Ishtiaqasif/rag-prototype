import * as dotenv from "dotenv";
dotenv.config();
import path from "path";
import { MongoClient } from "mongodb";
import { IngestionService } from "../application/IngestionService";
import { JsonVectorStore } from "../infrastructure/vector/JsonVectorStore";
import { MongoVectorStore } from "../infrastructure/vector/MongoVectorStore";
import { OllamaClient } from "../infrastructure/llm/OllamaClient";
import { IVectorStore } from "../core/interfaces/IVectorStore";

const DATA_DIR = process.env.DATA_DIR || "data/top100";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3.2:latest";
const VECTOR_STORE = process.env.VECTOR_STORE || "json";
const JSON_STORAGE_PATH = path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");

// MongoDB Config
const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "cv-bank";
const MONGODB_COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || "content";
const MONGODB_INDEX_NAME = process.env.MONGODB_INDEX_NAME || "vector_index";

async function main() {
    console.log(`Starting Ingestion (Store: ${VECTOR_STORE})...`);

    const embeddings = new OllamaClient(EMBEDDING_MODEL);
    let vectorStore: IVectorStore;
    let mongoClient: MongoClient | null = null;

    if (VECTOR_STORE === "json") {
        vectorStore = new JsonVectorStore(embeddings, JSON_STORAGE_PATH);
    } else if (VECTOR_STORE === "mongodb") {
        if (!MONGODB_ATLAS_URI) {
            console.error("Missing MONGODB_ATLAS_URI.");
            process.exit(1);
        }
        mongoClient = new MongoClient(MONGODB_ATLAS_URI);
        await mongoClient.connect();
        const collection = mongoClient.db(MONGODB_DB_NAME).collection(MONGODB_COLLECTION_NAME);

        vectorStore = new MongoVectorStore(mongoClient, collection, embeddings, {
            indexName: MONGODB_INDEX_NAME,
            textKey: "text",
            embeddingKey: "embedding"
        });
    } else {
        console.error(`Unsupported store: ${VECTOR_STORE}`);
        process.exit(1);
    }

    const service = new IngestionService(vectorStore);
    await service.ingestDirectory(DATA_DIR);

    console.log("Ingestion complete.");

    if (mongoClient) {
        await mongoClient.close();
    }
}

main().catch(console.error);
