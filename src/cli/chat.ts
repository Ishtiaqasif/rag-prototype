import readline from "readline";
import { MongoClient } from "mongodb";
import { ChatService } from "../application/ChatService";
import { JsonVectorStore } from "../infrastructure/vector/JsonVectorStore";
import { MongoVectorStore } from "../infrastructure/vector/MongoVectorStore";
import { OllamaClient } from "../infrastructure/llm/OllamaClient";
import { OllamaChatModel } from "../infrastructure/llm/OllamaChatModel";
import { IVectorStore } from "../core/interfaces/IVectorStore";
import { ConfigService } from "../core/config/ConfigService";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

async function main() {
    const config = ConfigService.getInstance();
    const storeType = config.vectorStoreType;

    console.log(`Starting Chat (Store: ${storeType})...`);

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

    const llm = new OllamaChatModel(config.llmModel);
    const service = new ChatService(vectorStore, llm);

    console.log("---------------------------------------------------------");
    console.log(`RAG System Ready. Type 'exit' to quit.`);
    console.log("---------------------------------------------------------");

    while (true) {
        const userInput = await askQuestion("\nYou: ");
        if (userInput.toLowerCase() === "exit") {
            console.log("Goodbye!");
            break;
        }
        if (!userInput.trim()) continue;

        try {
            console.log("Thinking...");
            const stream = await service.ask(userInput);

            process.stdout.write("AI: ");
            for await (const chunk of stream) {
                process.stdout.write(chunk);
            }
            process.stdout.write("\n");
        } catch (error) {
            console.error("Error:", error);
        }
    }

    rl.close();
    if (mongoClient) {
        await mongoClient.close();
    }
}

main().catch(console.error);
