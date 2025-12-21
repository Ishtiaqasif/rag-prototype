import * as dotenv from "dotenv";
dotenv.config();

import { ChatOllama } from "@langchain/ollama";
import { OllamaEmbeddings } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import * as readline from "readline";
import path from "path";
import fs from "fs";

// --- Configuration ---
const MODEL_NAME = process.env.LLM_MODEL || "llama3";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";
const VECTOR_STORE = process.env.VECTOR_STORE || "pgvector";
const JSON_STORAGE_PATH = path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");

// --- State ---
let currentJobDescription = "";

// --- Setup CLI ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

// --- Helper Functions ---
function getDiversityDocs(docs: any[], count: number = 5): any[] {
    // Basic diversity: prefer chunks from different sources
    const uniqueSources = new Set<string>();
    const diverseDocs = [];

    for (const doc of docs) {
        // If we haven't seen this source yet, take it
        const source = doc.metadata.source;
        if (!uniqueSources.has(source)) {
            uniqueSources.add(source);
            diverseDocs.push(doc);
        }
        if (diverseDocs.length >= count) break;
    }

    return diverseDocs;
}

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

const formatDocumentsAsString = (documents: any[]) => {
    return documents.map((doc) => {
        const filename = path.basename(doc.metadata.source);
        return `--- Candidate File: ${filename} ---\n${doc.pageContent}\n----------------`;
    }).join("\n\n");
};

async function main() {
    console.log("---------------------------------------");
    console.log(`AI Recruiter System (Store: ${VECTOR_STORE})`);
    console.log("---------------------------------------");

    const embeddings = new OllamaEmbeddings({
        model: EMBEDDING_MODEL,
    });

    let vectorStore: any;

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
    } else if (VECTOR_STORE === "json") {
        console.log(`Using JSON Storage: ${JSON_STORAGE_PATH}`);
    } else {
        console.error(`Unsupported VECTOR_STORE: ${VECTOR_STORE}`);
        process.exit(1);
    }

    // We retrieve more docs to ensure diversity
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
                    .slice(0, 20); // Get k=20 for diversity filtering

                return results.map((r: any) => ({
                    pageContent: r.content,
                    metadata: r.metadata
                }));
            }
        };
    } else {
        retriever = vectorStore.asRetriever({
            k: 20,
            searchType: "similarity",
        });
    }

    // 2. Setup LLM
    const llm = new ChatOllama({
        model: MODEL_NAME,
        temperature: 0.3,
    });

    // 3. User Interaction for JD
    console.log("\nPlease provide the Job Description (JD).");
    console.log("You can paste the text below. Type 'DONE' on a new line when finished, or provide a file path.");

    let jdLines: string[] = [];
    while (true) {
        const line = await askQuestion("> ");
        if (line.trim() === "DONE") break;
        if (line.trim().startsWith("LOAD:")) {
            try {
                const jdPath = line.trim().substring(5).trim();
                currentJobDescription = fs.readFileSync(jdPath, "utf-8");
                console.log(`Loaded JD from ${jdPath}`);
                break;
            } catch (e) {
                console.error("Error loading file:", e);
                continue;
            }
        }
        jdLines.push(line);
    }
    if (!currentJobDescription && jdLines.length > 0) {
        currentJobDescription = jdLines.join("\n");
    }

    if (!currentJobDescription) {
        console.log("No JD provided. Using empty JD (results may be poor).");
    } else {
        console.log("\nJD Set! (" + currentJobDescription.length + " chars)");
    }

    console.log("\nReady to chat. Ask me to shortlist candidates, compare them, etc.");

    // 4. Chat Loop
    const systemTemplate = `You are an expert AI Recruiter aiding a hiring manager.
    
JOB DESCRIPTION:
{jd}

CANDIDATE DATA (Retrieved chunks from CVs):
{context}

Based on the JD and the candidate data provided:
- Analyze the candidates.
- Answer the user's question.
- Always cite the candidate's filename or name.

Question: {question}
Answer:`;

    const prompt = ChatPromptTemplate.fromTemplate(systemTemplate);

    while (true) {
        const userInput = await askQuestion("\nYou: ");
        if (userInput.toLowerCase() === "exit") break;
        if (!userInput.trim()) continue;

        console.log("Searching CVs...");

        // We do a manual retrieval to handle diversity filtering before passing to LLM
        // Note: langchain's Runnable chain with retriever would just pass raw k docs.
        // We want to intervene.

        const retrievedDocs = await retriever.invoke(userInput + " " + currentJobDescription); // Mix query with JD for better semantic match
        console.log(`Found ${retrievedDocs.length} relevant chunks.`);
        const diverseDocs = getDiversityDocs(retrievedDocs, 5); // Pick top 5 unique candidates if possible

        const contextString = formatDocumentsAsString(diverseDocs);

        console.log(`(Found ${retrievedDocs.length} chunks, selected ${diverseDocs.length} unique candidates for context)`);

        const chain = RunnableSequence.from([
            prompt,
            llm,
            new StringOutputParser()
        ]);

        console.log("Thinking...");
        const stream = await chain.stream({
            jd: currentJobDescription,
            context: contextString,
            question: userInput
        });

        process.stdout.write("AI: ");
        for await (const chunk of stream) {
            process.stdout.write(chunk);
        }
        process.stdout.write("\n");
    }

    rl.close();
}

main().catch(console.error);
