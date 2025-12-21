import * as dotenv from "dotenv";
dotenv.config();

console.log("--- CONFIGURATION CHECK ---");
console.log("VECTOR_STORE:", process.env.VECTOR_STORE || "pgvector (DEFAULT)");
console.log("EMBEDDING_MODEL:", process.env.EMBEDDING_MODEL || "llama3 (DEFAULT)");
console.log("PINECONE_INDEX:", process.env.PINECONE_INDEX || "NOT SET");
console.log("---------------------------");

import { OllamaEmbeddings } from "@langchain/ollama";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

async function testRetrieval() {
    if (process.env.VECTOR_STORE !== "pinecone") {
        console.log("VECTOR_STORE is not set to pinecone in .env. Current logic in index.ts/recruiter.ts will default to pgvector.");
    }

    const embeddings = new OllamaEmbeddings({ model: process.env.EMBEDDING_MODEL || "llama3" });
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const pineconeIndex = pc.Index(process.env.PINECONE_INDEX!);

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
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex });

    console.log("Testing LangChain similaritySearch for 'software engineer'...");
    const results = await vectorStore.similaritySearch("software engineer", 3);

    console.log(`Found ${results.length} results.`);
    results.forEach((res: any, i: number) => {
        console.log(`\nResult ${i + 1}:`);
        console.log(`Source: ${res.metadata.source}`);
        console.log(`Email: ${res.metadata.email}`);
        console.log(`Content Preview: ${res.pageContent.substring(0, 100)}...`);
    });
}

testRetrieval().catch(console.error);
