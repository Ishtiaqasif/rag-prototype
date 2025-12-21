import * as dotenv from "dotenv";
dotenv.config();

import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import * as readline from "readline";

// --- Configuration ---
const MODEL_NAME = process.env.LLM_MODEL || "llama3";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "llama3";
const VECTOR_STORE = process.env.VECTOR_STORE || "pgvector";

// --- Setup CLI ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

const formatDocumentsAsString = (documents: any[]) => {
    return documents.map((document) => document.pageContent).join("\n\n");
};

async function main() {
    console.log(`Initializing RAG System (Store: ${VECTOR_STORE})...`);

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
    } else {
        console.error(`Unsupported VECTOR_STORE: ${VECTOR_STORE}`);
        process.exit(1);
    }

    const retriever = vectorStore.asRetriever({
        k: 10, // Retrieve top 4 chunks
        searchType: "similarity",
    });

    // 2. Setup LLM and Prompts
    const llm = new ChatOllama({
        model: MODEL_NAME,
        temperature: .2, // Low temperature for factual RAG
    });

    const template = `Answer the question based only on the following context:
{context}

Question: {question}

Answer:`;

    const prompt = ChatPromptTemplate.fromTemplate(template);

    // 3. Create Chain
    // We use a RunnableSequence for clear step-by-step logic
    const chain = RunnableSequence.from([
        {
            context: retriever.pipe(formatDocumentsAsString),
            question: new RunnablePassthrough(),
        },
        prompt,
        llm,
        new StringOutputParser(),
    ]);

    console.log("---------------------------------------------------------");
    console.log(`RAG System Ready. LLM: ${llm.model}, Temp: ${llm.temperature}. Type 'exit' to quit.`);
    console.log("---------------------------------------------------------");

    // 4. Interactive Loop
    while (true) {
        const userInput = await askQuestion("\nYou: ");

        if (userInput.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            process.exit(0);
        }

        if (!userInput.trim()) continue;

        try {
            console.log("Searching resume bank...");
            const retrievedDocs = await retriever.invoke(userInput);
            console.log(`Found ${retrievedDocs.length} relevant chunks.`);

            console.log("Thinking...");
            // Stream the response for better UX
            const stream = await chain.stream(userInput);

            process.stdout.write("AI: ");
            for await (const chunk of stream) {
                process.stdout.write(chunk);
            }
            process.stdout.write("\n");

            // Optional: Retrieve and show sources (requires breaking the chain to access intermediate steps, 
            // or using a chain that returns source documents. For simplicity in this stream, we skipped printing sources per-turn, 
            // but you can inspect `retriever.getRelevantDocuments(userInput)` if debugging.)

        } catch (error) {
            console.error("Error generating response:", error);
        }
    }
}

main().catch(console.error);
