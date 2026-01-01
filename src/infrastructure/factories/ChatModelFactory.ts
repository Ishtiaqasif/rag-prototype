import { ConfigService } from "../../core/config/ConfigService";
import { IChatModel } from "../../core/interfaces/IChatModel";
import { GoogleChatModel } from "../llm/GoogleChatModel";
import { OllamaChatModel } from "../llm/OllamaChatModel";
import { OpenAIChatModel } from "../llm/OpenAIChatModel";

export class ChatModelFactory {
    static create(config: ConfigService, temperature?: number): IChatModel {
        const provider = config.llmProvider;

        if (provider === "google") {
            const temp = temperature !== undefined ? temperature : 0.7; // Default for Google
            return new GoogleChatModel(config.googleApiKey, config.googleModel, temp);

        } else if (provider === "openai") {
            const temp = temperature !== undefined ? temperature : 0.7; // Default for OpenAI
            return new OpenAIChatModel(config.openaiApiKey, config.openaiModel, temp);

        } else if (provider === "ollama") {
            const temp = temperature !== undefined ? temperature : 0.2; // Default for Ollama
            return new OllamaChatModel(config.llmModel, temp);

        } else {
            throw new Error(`Unsupported LLM Provider: ${provider}`);
        }
    }
}
