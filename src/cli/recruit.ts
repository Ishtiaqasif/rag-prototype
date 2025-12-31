import * as dotenv from "dotenv";
dotenv.config();
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

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3.2:latest";
const LLM_MODEL = process.env.LLM_MODEL || "llama3";
const VECTOR_STORE = process.env.VECTOR_STORE || "json";
const JSON_STORAGE_PATH = path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");

const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "cv-bank";
const MONGODB_COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || "content";
const MONGODB_INDEX_NAME = process.env.MONGODB_INDEX_NAME || "vector_index";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

async function main() {
    console.log(`Starting AI Recruiter (Store: ${VECTOR_STORE})...`);

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

    const llm = new OllamaChatModel(LLM_MODEL, 0.3);
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
