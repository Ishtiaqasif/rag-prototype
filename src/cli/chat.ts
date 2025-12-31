import readline from "readline";
import { ChatService } from "../application/ChatService";
import { OllamaClient } from "../infrastructure/llm/OllamaClient";
import { OllamaChatModel } from "../infrastructure/llm/OllamaChatModel";
import { ConfigService } from "../core/config/ConfigService";
import { VectorStoreFactory } from "../infrastructure/factories/VectorStoreFactory";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve));

async function main() {
    const config = ConfigService.getInstance();
    console.log(`Starting Chat (Store: ${config.vectorStoreType})...`);

    const embeddings = new OllamaClient(config.embeddingModel);

    // Usage of Factory Pattern
    const vectorStore = await VectorStoreFactory.create(config, embeddings);
    const llm = new OllamaChatModel(config.llmModel);
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
