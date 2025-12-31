import * as dotenv from "dotenv";
dotenv.config();

import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import * as readline from "readline";
import path from "path";
import fs from "fs";

// --- Configuration ---
const MODEL_NAME = process.env.LLM_MODEL || "llama3";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3.2:latest";
const VECTOR_STORE = process.env.VECTOR_STORE || "json";
const JSON_STORAGE_PATH = path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");

// MongoDB Config
const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "cv-bank";
const MONGODB_COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || "content";
const MONGODB_INDEX_NAME = process.env.MONGODB_INDEX_NAME || "vector_index";

// --- Setup CLI ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

const formatDocumentsAsString = (documents: any[]) => {
    return documents.map((document) => document.pageContent).join("\n\n");
};

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
    console.log(`Initializing RAG System (Store: ${VECTOR_STORE})...`);

    const embeddings = new OllamaEmbeddings({
        model: EMBEDDING_MODEL,
    });

    let vectorStore: any;
    let mongoClient: MongoClient | null = null;

    if (VECTOR_STORE === "pgvector") {
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
        vectorStore = await PGVectorStore.initialize(embeddings, {
            postgresConnectionOptions: pgConfig,
            tableName: "cv_documents",
            columns: {
                idColumnName: "id",
                vectorColumnName: "embedding",
                contentColumnName: "text",
                metadataColumnName: "metadata",
            },
        });
    } else if (VECTOR_STORE === "pinecone") {
        if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
            console.error("Missing Pinecone connection details in .env file.");
            process.exit(1);
        }
        const { Pinecone } = await import("@pinecone-database/pinecone");
        const { PineconeStore } = await import("@langchain/pinecone");
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const pineconeIndex = pc.Index(process.env.PINECONE_INDEX);
        vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex,
        });
    } else if (VECTOR_STORE === "mongodb") {
        if (!MONGODB_ATLAS_URI) {
            console.error("Missing MONGODB_ATLAS_URI in .env file.");
            process.exit(1);
        }
        mongoClient = new MongoClient(MONGODB_ATLAS_URI);
        await mongoClient.connect();
        const collection = mongoClient.db(MONGODB_DB_NAME).collection(MONGODB_COLLECTION_NAME);

        vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection: collection as any,
            indexName: MONGODB_INDEX_NAME,
            textKey: "text",
            embeddingKey: "embedding",
        });
        console.log("MongoDB Atlas Vector Search initialized.");
    } else if (VECTOR_STORE === "json") {
        console.log(`Using JSON Storage: ${JSON_STORAGE_PATH}`);
    } else {
        console.error(`Unsupported VECTOR_STORE: ${VECTOR_STORE}`);
        process.exit(1);
    }

    let retriever: any;
    if (VECTOR_STORE === "json") {
        retriever = {
            invoke: async (query: string) => {
                if (!fs.existsSync(JSON_STORAGE_PATH)) return [];
                const data = JSON.parse(fs.readFileSync(JSON_STORAGE_PATH, "utf-8"));
                const queryVector = await embeddings.embedQuery(query);
                const results = data
                    .map((item: any) => ({
                        ...item,
                        score: cosineSimilarity(queryVector, item.vector)
                    }))
                    .sort((a: any, b: any) => b.score - a.score)
                    .slice(0, 10);

                return results.map((r: any) => ({
                    pageContent: r.content,
                    metadata: r.metadata
                }));
            },
            pipe: (fn: any) => {
                const next = async (query: string) => {
                    const docs = await retriever.invoke(query);
                    return fn(docs);
                };
                return { invoke: next };
            }
        };
    } else {
        retriever = vectorStore.asRetriever({
            k: 100, // Retrieve top 10 chunks
            searchType: "cosine",
        });
    }

    // 2. Setup LLM and Prompts
    const llm = new ChatOllama({
        model: MODEL_NAME,
        temperature: .2, // Low temperature for factual RAG
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
    console.log(`RAG System Ready. LLM: ${llm.model}, Temp: ${llm.temperature}. Type 'exit' to quit.`);
    console.log("---------------------------------------------------------");

    // 4. Interactive Loop
    while (true) {
        const userInput = await askQuestion("\nYou: ");

        if (userInput.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            process.exit(0);
        }

        if (!userInput.trim()) continue;

        try {
            console.log("Searching resume bank...");
            const retrievedDocs = await retriever.invoke(userInput);
            //console.log(`Found ${retrievedDocs.length} relevant chunks.`);

            //for (const doc of retrievedDocs) {
            //    console.log(`retrievedDocs ${Object.keys(doc)}`);
            //}

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
