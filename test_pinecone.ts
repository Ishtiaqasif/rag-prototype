import * as dotenv from "dotenv";
dotenv.config();
import { Pinecone } from "@pinecone-database/pinecone";
import { OllamaEmbeddings } from "@langchain/ollama";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";

async function test() {
    console.log("Testing Pinecone connection...");
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const indexName = process.env.PINECONE_INDEX!;
    console.log(`Using Index: ${indexName}`);

    const index = pc.Index(indexName);

    console.log("Checking Embeddings...");
    const embeddings = new OllamaEmbeddings({ model: EMBEDDING_MODEL });
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

    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
