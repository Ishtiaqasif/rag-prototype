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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ollama_1 = require("@langchain/ollama");
const ollama_2 = require("@langchain/ollama");
const memory_1 = require("@langchain/classic/vectorstores/memory");
const output_parsers_1 = require("@langchain/core/output_parsers");
const prompts_1 = require("@langchain/core/prompts");
const runnables_1 = require("@langchain/core/runnables");
const readline = __importStar(require("readline"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// --- Configuration ---
const VECTOR_STORE_PATH = path_1.default.join(process.cwd(), process.env.LANCEDB_URI || "data", "cv_vectors.json");
const MODEL_NAME = process.env.LLM_MODEL || "llama3";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";
// --- State ---
let currentJobDescription = "";
// --- Setup CLI ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));
// --- Helper Functions ---
function getDiversityDocs(docs, count = 5) {
    // Basic diversity: prefer chunks from different sources
    const uniqueSources = new Set();
    const diverseDocs = [];
    for (const doc of docs) {
        // If we haven't seen this source yet, take it
        const source = doc.metadata.source;
        if (!uniqueSources.has(source)) {
            uniqueSources.add(source);
            diverseDocs.push(doc);
        }
        if (diverseDocs.length >= count)
            break;
    }
    // If we didn't get enough unique sources, fill up with remaining high-score docs (if we had scores, but here we assume order is score)
    // For now, let's just return what we have and maybe fill the rest if strictly needed, 
    // but usually user wants "Shortlist N", so uniqueness is key.
    // If we only have 1 candidate match, we just return that.
    return diverseDocs;
}
const formatDocumentsAsString = (documents) => {
    return documents.map((doc) => {
        const filename = path_1.default.basename(doc.metadata.source);
        return `--- Candidate File: ${filename} ---\n${doc.pageContent}\n----------------`;
    }).join("\n\n");
};
async function main() {
    console.log("---------------------------------------");
    console.log("Initializing AI Recruiter System...");
    console.log("---------------------------------------");
    // 1. Load Vector DB
    if (!fs_1.default.existsSync(VECTOR_STORE_PATH)) {
        console.error(`Error: Vector store not found at ${VECTOR_STORE_PATH}. Please run ingest_cvs.ts first.`);
        process.exit(1);
    }
    const embeddings = new ollama_2.OllamaEmbeddings({
        model: EMBEDDING_MODEL,
    });
    console.log("Loading CV vectors...");
    const vectors = JSON.parse(fs_1.default.readFileSync(VECTOR_STORE_PATH, "utf-8"));
    const vectorStore = new memory_1.MemoryVectorStore(embeddings);
    // @ts-ignore - memoryVectors is internal but we can set it for loading
    vectorStore.memoryVectors = vectors;
    // We retrieve more docs to ensure diversity
    const retriever = vectorStore.asRetriever({
        k: 20,
        searchType: "similarity",
    });
    // 2. Setup LLM
    const llm = new ollama_1.ChatOllama({
        model: MODEL_NAME,
        temperature: 0.3,
    });
    // 3. User Interaction for JD
    console.log("\nPlease provide the Job Description (JD).");
    console.log("You can paste the text below. Type 'DONE' on a new line when finished, or provide a file path.");
    let jdLines = [];
    while (true) {
        const line = await askQuestion("> ");
        if (line.trim() === "DONE")
            break;
        if (line.trim().startsWith("LOAD:")) {
            try {
                const jdPath = line.trim().substring(5).trim();
                currentJobDescription = fs_1.default.readFileSync(jdPath, "utf-8");
                console.log(`Loaded JD from ${jdPath}`);
                break;
            }
            catch (e) {
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
    }
    else {
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
    const prompt = prompts_1.ChatPromptTemplate.fromTemplate(systemTemplate);
    while (true) {
        const userInput = await askQuestion("\nYou: ");
        if (userInput.toLowerCase() === "exit")
            break;
        if (!userInput.trim())
            continue;
        console.log("Searching CVs...");
        // We do a manual retrieval to handle diversity filtering before passing to LLM
        // Note: langchain's Runnable chain with retriever would just pass raw k docs.
        // We want to intervene.
        const retrievedDocs = await retriever._getRelevantDocuments(userInput + " " + currentJobDescription); // Mix query with JD for better semantic match
        const diverseDocs = getDiversityDocs(retrievedDocs, 5); // Pick top 5 unique candidates if possible
        const contextString = formatDocumentsAsString(diverseDocs);
        console.log(`(Found ${retrievedDocs.length} chunks, selected ${diverseDocs.length} unique candidates for context)`);
        const chain = runnables_1.RunnableSequence.from([
            prompt,
            llm,
            new output_parsers_1.StringOutputParser()
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
