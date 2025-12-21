import * as dotenv from "dotenv";
dotenv.config();

import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import * as readline from "readline";
import path from "path";
import fs from "fs";

// --- Configuration ---
const MODEL_NAME = process.env.LLM_MODEL || "llama3"; // Ensure this matches what you pulled
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";

// --- Setup CLI ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

const formatDocumentsAsString = (documents: any[]) => {
    return documents.map((document) => document.pageContent).join("\n\n");
};

async function main() {
    console.log("Initializing RAG System...");

    // 1. Load Vector DB
    if (!process.env.PG_HOST || !process.env.PG_USER || !process.env.PG_PASSWORD || !process.env.PG_DATABASE) {
        console.error("Missing PostgreSQL connection details in .env file.");
        process.exit(1);
    }

    const embeddings = new OllamaEmbeddings({
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

    const vectorStore = await PGVectorStore.initialize(embeddings, {
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
    const llm = new ChatOllama({
        model: MODEL_NAME,
        temperature: 0.2, // Low temperature for factual RAG
    });

    const template = `Answer the question based only on the following context:
{context}

Question: {question}

Answer:`;

    const prompt = ChatPromptTemplate.fromTemplate(template);

    // 3. Create Chain
    // We use a RunnableSequence for clear step-by-step logic
    const chain = RunnableSequence.from([
        {
            context: retriever.pipe(formatDocumentsAsString),
            question: new RunnablePassthrough(),
        },
        prompt,
        llm,
        new StringOutputParser(),
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

        if (!userInput.trim()) continue;

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

        } catch (error) {
            console.error("Error generating response:", error);
        }
    }
}

main().catch(console.error);
