import path from "path";
import readline from "readline";
import fs from "fs";
import { MongoClient } from "mongodb";
import { RecruiterService } from "../application/RecruiterService";
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
    console.log(`Starting AI Recruiter (Store: ${storeType})...`);

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

    const llm = new OllamaChatModel(config.llmModel, 0.3);
    const service = new RecruiterService(vectorStore, llm);

    // --- JD Input ---
    console.log("\nPlease provide the Job Description (JD).");
    console.log("You can paste the text below. Type 'DONE' on a new line when finished, or 'LOAD: path/to/file'.");

    let jdLines: string[] = [];
    while (true) {
        const line = await askQuestion("> ");
        if (line.trim() === "DONE") break;
        if (line.trim().startsWith("LOAD:")) {
            try {
                const jdPath = line.trim().substring(5).trim();
                const content = fs.readFileSync(jdPath, "utf-8");
                jdLines = [content];
                console.log(`Loaded JD from ${jdPath}`);
                break;
            } catch (e) {
                console.error("Error loading file:", e);
                continue;
            }
        }
        jdLines.push(line);
    }

    const jd = jdLines.join("\n");
    service.setJobDescription(jd);
    console.log("\nJD Set!");

    console.log("\nReady to chat. Ask me to shortlist candidates, compare them, etc.");

    while (true) {
        const userInput = await askQuestion("\nYou: ");
        if (userInput.toLowerCase() === "exit") {
            console.log("Goodbye!");
            break;
        }
        if (!userInput.trim()) continue;

        try {
            console.log("Searching and Thinking...");
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
