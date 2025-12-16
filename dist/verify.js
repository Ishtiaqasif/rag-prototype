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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const formatDocumentsAsString = (documents) => {
    return documents.map((document) => document.pageContent).join("\n\n");
};
async function verify() {
    console.log("Running Verification Test...");
    const VECTOR_STORE_PATH = path_1.default.join(process.cwd(), process.env.LANCEDB_URI || "data", "vectors.json");
    const MODEL = process.env.LLM_MODEL || "llama3";
    const EMBED_MODEL = process.env.EMBEDDING_MODEL || "llama3";
    // 1. Setup
    const embeddings = new ollama_1.OllamaEmbeddings({ model: EMBED_MODEL });
    console.log("Loading vectors from disk...");
    const vectors = JSON.parse(fs_1.default.readFileSync(VECTOR_STORE_PATH, "utf-8"));
    const vectorStore = new memory_1.MemoryVectorStore(embeddings);
    vectorStore.memoryVectors = vectors;
    const retriever = vectorStore.asRetriever(2);
    const llm = new ollama_2.ChatOllama({ model: MODEL, temperature: 0 });
    const template = `Answer the question briefly based on context: {context} Question: {question}`;
    const chain = runnables_1.RunnableSequence.from([
        { context: retriever.pipe(formatDocumentsAsString), question: new runnables_1.RunnablePassthrough() },
        prompts_1.ChatPromptTemplate.fromTemplate(template),
        llm,
        new output_parsers_1.StringOutputParser(),
    ]);
    // 2. Test Query
    const query = "How far is the moon?";
    console.log(`Query: "${query}"`);
    const result = await chain.invoke(query);
    console.log(`Result: "${result}"`);
    if (result.length > 0) {
        console.log("✅ Verification Passed: received non-empty response.");
    }
    else {
        console.error("❌ Verification Failed: Empty response.");
        process.exit(1);
    }
}
verify().catch(e => {
    console.error(e);
    process.exit(1);
});
