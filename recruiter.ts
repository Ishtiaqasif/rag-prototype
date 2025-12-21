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

    // If we didn't get enough unique sources, fill up with remaining high-score docs (if we had scores, but here we assume order is score)
    // For now, let's just return what we have and maybe fill the rest if strictly needed, 
    // but usually user wants "Shortlist N", so uniqueness is key.
    // If we only have 1 candidate match, we just return that.

    return diverseDocs;
}

const formatDocumentsAsString = (documents: any[]) => {
    return documents.map((doc) => {
        const filename = path.basename(doc.metadata.source);
        return `--- Candidate File: ${filename} ---\n${doc.pageContent}\n----------------`;
    }).join("\n\n");
};

async function main() {
    console.log("---------------------------------------");
    console.log("Initializing AI Recruiter System...");
    console.log("---------------------------------------");

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

    // We retrieve more docs to ensure diversity
    const retriever = vectorStore.asRetriever({
        k: 20,
        searchType: "similarity",
    });

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

        const retrievedDocs = await retriever._getRelevantDocuments(userInput + " " + currentJobDescription); // Mix query with JD for better semantic match
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
