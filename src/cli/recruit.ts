import readline from "readline";
import fs from "fs";
import { RecruiterService } from "../application/RecruiterService";
import { OllamaClient } from "../infrastructure/llm/OllamaClient";
import { OllamaChatModel } from "../infrastructure/llm/OllamaChatModel";
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

    const temperature = 0.3;

    console.log("---------------------------------------------------------");
    console.log(`AI Recruiter Startup`);
    console.log(`Vector Store : ${config.vectorStoreType}`);
    console.log(`LLM Provider : ${provider}`);
    console.log(`Model Name   : ${modelName}`);
    console.log(`Temperature  : ${temperature}`);
    console.log("---------------------------------------------------------");

    const embeddings = EmbeddingModelFactory.create(config);

    // Usage of Factory Pattern for Vector Store
    const vectorStore = await VectorStoreFactory.create(config, embeddings);

    // Usage of Factory Pattern for LLM (Polymorphic)
    const llm = ChatModelFactory.create(config, temperature);

    const service = new RecruiterService(vectorStore, llm);

    try {
        // --- JD Input ---
        console.log("\nPlease provide the Job Description (JD).");
        console.log("You can paste the text below. Type 'DONE' on a new line when finished, or 'LOAD: path/to/file'.");

        let jdLines: string[] = [];
        while (true) {
            const line = await askQuestion("> ");
            if (line.trim() === "DONE") break;
            if (line.trim().startsWith("LOAD:")) {
                try {
                    const jdPath = line.trim().substring(5).trim();
                    const content = fs.readFileSync(jdPath, "utf-8");
                    jdLines = [content];
                    console.log(`Loaded JD from ${jdPath}`);
                    break;
                } catch (e) {
                    console.error("Error loading file:", e);
                    continue;
                }
            }
            jdLines.push(line);
        }

        const jd = jdLines.join("\n");
        service.setJobDescription(jd);
        console.log("\nJD Set!");

        console.log("\nReady to chat. Ask me to shortlist candidates, compare them, etc.");

        while (true) {
            const userInput = await askQuestion("\nYou: ");
            if (userInput.toLowerCase() === "exit") {
                console.log("Goodbye!");
                break;
            }
            if (!userInput.trim()) continue;

            try {
                console.log("Searching and Thinking...");
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
