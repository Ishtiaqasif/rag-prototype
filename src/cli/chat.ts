import readline from "readline";
import { ChatService } from "../application/ChatService";
import { OllamaClient } from "../infrastructure/llm/OllamaClient";
import { ConfigService } from "../core/config/ConfigService";
import { VectorStoreFactory } from "../infrastructure/factories/VectorStoreFactory";
import { ChatModelFactory } from "../infrastructure/factories/ChatModelFactory";
import { EmbeddingModelFactory } from "../infrastructure/factories/EmbeddingModelFactory";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

async function main() {
    const config = ConfigService.getInstance();
    const provider = config.llmProvider;

    let modelName = config.llmModel; // Default (ollama)
    if (provider === "google") modelName = config.googleModel;
    if (provider === "openai") modelName = config.openaiModel;

    const temperature = 0.1;

    console.log("---------------------------------------------------------");
    console.log(`RAG Application Startup`);
    console.log(`Vector Store : ${config.vectorStoreType}`);
    console.log(`LLM Provider : ${provider}`);
    console.log(`Model Name   : ${modelName}`);
    console.log(`Temperature  : ${temperature}`);
    console.log("---------------------------------------------------------");

    const embeddings = EmbeddingModelFactory.create(config);

    // Usage of Factory Pattern for Vector Store
    const vectorStore = await VectorStoreFactory.create(config, embeddings);

    // Usage of Factory Pattern for LLM (Polymorphic)
    const llm = ChatModelFactory.create(config, temperature); // Low temp for accuracy

    const service = new ChatService(vectorStore, llm);

    console.log("---------------------------------------------------------");
    console.log(`RAG System Ready. Type 'exit' to quit.`);
    console.log("---------------------------------------------------------");

    try {
        while (true) {
            const userInput = await askQuestion("\nYou: ");
            if (userInput.toLowerCase() === "exit") {
                console.log("Goodbye!");
                break;
            }
            if (!userInput.trim()) continue;

            try {
                console.log("Thinking...");
                const stream = await service.ask(userInput);

                process.stdout.write("AI: ");
                for await (const chunk of stream) {
                    process.stdout.write(chunk);
                }
                process.stdout.write("\n");
            } catch (error) {
                console.error("Error:", error);
            }
        }
    } finally {
        // Polymorphic cleanup
        rl.close();
        await vectorStore.close();
    }
}

main().catch(console.error);
