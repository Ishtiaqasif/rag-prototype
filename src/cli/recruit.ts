import readline from "readline";
import fs from "fs";
import { RecruiterService } from "../application/RecruiterService";
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
    console.log(`Starting AI Recruiter (Store: ${config.vectorStoreType})...`);

    const embeddings = new OllamaClient(config.embeddingModel);

    // Usage of Factory Pattern
    const vectorStore = await VectorStoreFactory.create(config, embeddings);
    const llm = new OllamaChatModel(config.llmModel, 0.3);
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
