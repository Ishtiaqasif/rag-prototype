import * as dotenv from "dotenv";
dotenv.config();

import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import path from "path";
import fs from "fs";

const formatDocumentsAsString = (documents: any[]) => {
    return documents.map((document) => document.pageContent).join("\n\n");
};

async function verify() {
    console.log("Running Verification Test...");

    const VECTOR_STORE_PATH = path.join(process.cwd(), process.env.LANCEDB_URI || "data", "vectors.json");
    const MODEL = process.env.LLM_MODEL || "llama3";
    const EMBED_MODEL = process.env.EMBEDDING_MODEL || "llama3";

    // 1. Setup
    const embeddings = new OllamaEmbeddings({ model: EMBED_MODEL });

    console.log("Loading vectors from disk...");
    const vectors = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, "utf-8"));
    const vectorStore = new MemoryVectorStore(embeddings);
    vectorStore.memoryVectors = vectors;

    const retriever = vectorStore.asRetriever(2);
    const llm = new ChatOllama({ model: MODEL, temperature: 0 });

    const template = `Answer the question briefly based on context: {context} Question: {question}`;
    const chain = RunnableSequence.from([
        { context: retriever.pipe(formatDocumentsAsString), question: new RunnablePassthrough() },
        ChatPromptTemplate.fromTemplate(template),
        llm,
        new StringOutputParser(),
    ]);

    // 2. Test Query
    const query = "How far is the moon?";
    console.log(`Query: "${query}"`);

    const result = await chain.invoke(query);
    console.log(`Result: "${result}"`);

    if (result.length > 0) {
        console.log("✅ Verification Passed: received non-empty response.");
    } else {
        console.error("❌ Verification Failed: Empty response.");
        process.exit(1);
    }
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
