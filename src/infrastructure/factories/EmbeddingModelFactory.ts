
import { ConfigService } from "../../core/config/ConfigService";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";
import { OllamaEmbeddingsWrapper } from "../llm/embeddings/OllamaEmbeddings";

export class EmbeddingModelFactory {
    static create(config: ConfigService): IEmbeddings {
        const provider = config.embeddingProvider;

        if (provider === "ollama" || provider === "nomic") {
            return new OllamaEmbeddingsWrapper(config.ollamaEmbeddingModel);
        } else {
            throw new Error(`Unsupported Embedding Provider: ${provider}`);
        }
    }
}
