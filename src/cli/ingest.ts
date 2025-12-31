import { MongoClient } from "mongodb";
import { IngestionService } from "../application/IngestionService";
import { JsonVectorStore } from "../infrastructure/vector/JsonVectorStore";
import { MongoVectorStore } from "../infrastructure/vector/MongoVectorStore";
import { OllamaClient } from "../infrastructure/llm/OllamaClient";
import { IVectorStore } from "../core/interfaces/IVectorStore";
import { ConfigService } from "../core/config/ConfigService";

async function main() {
    const config = ConfigService.getInstance();
    const storeType = config.vectorStoreType;

    console.log(`Starting Ingestion (Store: ${storeType})...`);

    // Pass model name to OllamaClient
    const embeddings = new OllamaClient(config.embeddingModel);
    let vectorStore: IVectorStore;
    let mongoClient: MongoClient | null = null;

    if (storeType === "json") {
        vectorStore = new JsonVectorStore(embeddings, config.jsonStoragePath);
    } else if (storeType === "mongodb") {
        mongoClient = new MongoClient(config.mongoUri);
        await mongoClient.connect();
        const collection = mongoClient.db(config.mongoDbName).collection(config.mongoCollectionName);

        vectorStore = new MongoVectorStore(mongoClient, collection, embeddings, {
            indexName: config.mongoIndexName,
            textKey: "text",
            embeddingKey: "embedding"
        });
    } else {
        console.error(`Unsupported store: ${storeType}`);
        process.exit(1);
    }

    const service = new IngestionService(vectorStore);
    await service.ingestDirectory(config.dataDir);

    console.log("Ingestion complete.");

    if (mongoClient) {
        await mongoClient.close();
    }
}

main().catch(console.error);
