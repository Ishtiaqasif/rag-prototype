import * as dotenv from "dotenv";
dotenv.config();

import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
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

    const MODEL = process.env.LLM_MODEL || "llama3";
    const EMBED_MODEL = process.env.EMBEDDING_MODEL || "llama3";

    // 1. Setup
    if (!process.env.PG_HOST || !process.env.PG_USER || !process.env.PG_PASSWORD || !process.env.PG_DATABASE) {
        console.error("Missing PostgreSQL connection details in .env file.");
        process.exit(1);
    }

    const embeddings = new OllamaEmbeddings({ model: EMBED_MODEL });

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

    const retriever = vectorStore.asRetriever({ k: 2 });
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
