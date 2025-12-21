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
console.log("--- CONFIGURATION CHECK ---");
console.log("VECTOR_STORE:", process.env.VECTOR_STORE || "pgvector (DEFAULT)");
console.log("EMBEDDING_MODEL:", process.env.EMBEDDING_MODEL || "llama3 (DEFAULT)");
console.log("PINECONE_INDEX:", process.env.PINECONE_INDEX || "NOT SET");
console.log("---------------------------");
const ollama_1 = require("@langchain/ollama");
const pinecone_1 = require("@langchain/pinecone");
const pinecone_2 = require("@pinecone-database/pinecone");
async function testRetrieval() {
    if (process.env.VECTOR_STORE !== "pinecone") {
        console.log("VECTOR_STORE is not set to pinecone in .env. Current logic in index.ts/recruiter.ts will default to pgvector.");
    }
    const embeddings = new ollama_1.OllamaEmbeddings({ model: process.env.EMBEDDING_MODEL || "llama3" });
    const pc = new pinecone_2.Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const pineconeIndex = pc.Index(process.env.PINECONE_INDEX);
    console.log("Initializing PineconeStore...");
    const stats = await pineconeIndex.describeIndexStats();
    console.log("Index Stats:", JSON.stringify(stats, null, 2));
    if (stats.totalRecordCount === 0) {
        console.log("WARNING: Index is empty!");
    }
    console.log("Testing direct SDK query (top 5 ids)...");
    const dummyVector = await embeddings.embedQuery("test");
    const directResults = await pineconeIndex.query({
        vector: dummyVector,
        topK: 5,
        includeMetadata: true
    });
    console.log(`Direct SDK found ${directResults.matches?.length || 0} matches.`);
    console.log("Initializing LangChain PineconeStore...");
    const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, { pineconeIndex });
    console.log("Testing LangChain similaritySearch for 'software engineer'...");
    const results = await vectorStore.similaritySearch("software engineer", 3);
    console.log(`Found ${results.length} results.`);
    results.forEach((res, i) => {
        console.log(`\nResult ${i + 1}:`);
        console.log(`Source: ${res.metadata.source}`);
        console.log(`Email: ${res.metadata.email}`);
        console.log(`Content Preview: ${res.pageContent.substring(0, 100)}...`);
    });
}
testRetrieval().catch(console.error);
