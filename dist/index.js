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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ollama_1 = require("@langchain/ollama");
const ollama_2 = require("@langchain/ollama");
const pgvector_1 = require("@langchain/community/vectorstores/pgvector");
const output_parsers_1 = require("@langchain/core/output_parsers");
const prompts_1 = require("@langchain/core/prompts");
const runnables_1 = require("@langchain/core/runnables");
const readline = __importStar(require("readline"));
// --- Configuration ---
const MODEL_NAME = process.env.LLM_MODEL || "llama3"; // Ensure this matches what you pulled
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";
// --- Setup CLI ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));
const formatDocumentsAsString = (documents) => {
    return documents.map((document) => document.pageContent).join("\n\n");
};
async function main() {
    console.log("Initializing RAG System...");
    // 1. Load Vector DB
    if (!process.env.PG_HOST || !process.env.PG_USER || !process.env.PG_PASSWORD || !process.env.PG_DATABASE) {
        console.error("Missing PostgreSQL connection details in .env file.");
        process.exit(1);
    }
    const embeddings = new ollama_1.OllamaEmbeddings({
        model: EMBEDDING_MODEL,
    });
    console.log("Connecting to PGVector store...");
    const pgConfig = {
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || "5432"),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
    };
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
    const retriever = vectorStore.asRetriever({
        k: 4, // Retrieve top 4 chunks
        searchType: "similarity",
    });
    // 2. Setup LLM and Prompts
    const llm = new ollama_2.ChatOllama({
        model: MODEL_NAME,
        temperature: 0.2, // Low temperature for factual RAG
    });
    const template = `Answer the question based only on the following context:
{context}

Question: {question}

Answer:`;
    const prompt = prompts_1.ChatPromptTemplate.fromTemplate(template);
    // 3. Create Chain
    // We use a RunnableSequence for clear step-by-step logic
    const chain = runnables_1.RunnableSequence.from([
        {
            context: retriever.pipe(formatDocumentsAsString),
            question: new runnables_1.RunnablePassthrough(),
        },
        prompt,
        llm,
        new output_parsers_1.StringOutputParser(),
    ]);
    console.log("---------------------------------------------------------");
    console.log("RAG System Ready. Type 'exit' to quit.");
    console.log("---------------------------------------------------------");
    // 4. Interactive Loop
    while (true) {
        const userInput = await askQuestion("\nYou: ");
        if (userInput.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            break;
        }
        if (!userInput.trim())
            continue;
        try {
            console.log("Thinking...");
            // Stream the response for better UX
            const stream = await chain.stream(userInput);
            process.stdout.write("AI: ");
            for await (const chunk of stream) {
                process.stdout.write(chunk);
            }
            process.stdout.write("\n");
            // Optional: Retrieve and show sources (requires breaking the chain to access intermediate steps, 
            // or using a chain that returns source documents. For simplicity in this stream, we skipped printing sources per-turn, 
            // but you can inspect `retriever.getRelevantDocuments(userInput)` if debugging.)
        }
        catch (error) {
            console.error("Error generating response:", error);
        }
    }
}
main().catch(console.error);
