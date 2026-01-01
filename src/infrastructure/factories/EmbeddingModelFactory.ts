import { ConfigService } from "../../core/config/ConfigService";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";
import { GoogleEmbeddings } from "../llm/GoogleEmbeddings";
import { OllamaClient } from "../llm/OllamaClient";
import { OpenAIEmbeddings } from "../llm/OpenAIEmbeddings";

export class EmbeddingModelFactory {
    static create(config: ConfigService): IEmbeddings {
        const provider = config.llmProvider;

        if (provider === "google") {
            return new GoogleEmbeddings(config.googleApiKey, config.googleEmbeddingModel);
        } else if (provider === "openai") {
            return new OpenAIEmbeddings(config.openaiApiKey, config.openaiEmbeddingModel);
        } else if (provider === "ollama") {
            return new OllamaClient(config.ollamaEmbeddingModel);
        } else {
            throw new Error(`Unsupported LLM Provider for embeddings: ${provider}`);
        }
    }
}
