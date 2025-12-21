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
const pinecone_1 = require("@pinecone-database/pinecone");
const ollama_1 = require("@langchain/ollama");
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";
async function test() {
    console.log("Testing Pinecone connection...");
    const pc = new pinecone_1.Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexName = process.env.PINECONE_INDEX;
    console.log(`Using Index: ${indexName}`);
    const index = pc.Index(indexName);
    console.log("Checking Embeddings...");
    const embeddings = new ollama_1.OllamaEmbeddings({ model: EMBEDDING_MODEL });
    const sample = await embeddings.embedQuery("test");
    console.log(`Embedding Dimensions: ${sample.length}`);
    try {
        const stats = await index.describeIndexStats();
        console.log("Success! Index Stats:", stats);
        console.log("Testing upsert...");
        await index.upsert([{
                id: "test-id-1",
                values: new Array(stats.dimension).fill(0.1),
                metadata: { test: true }
            }]);
        console.log("Upsert successful!");
        console.log("Testing delete...");
        await index.deleteOne("test-id-1");
        console.log("Delete successful!");
    }
    catch (e) {
        console.error("Test failed:", e);
    }
}
test();
