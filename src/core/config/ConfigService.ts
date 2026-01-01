import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

export class ConfigService {
    private static instance: ConfigService;

    private constructor() {
        // Validate strictly on instantiation? 
        // Or lazy validation? 
        // User said "if anything is unavailable throw expection". 
        // Lazy validation via getters is safer for conditional usage (like Mongo vs JSON).
    }

    public static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    private getOrThrow(key: string): string {
        const val = process.env[key];
        if (!val || val.trim() === "") {
            throw new Error(`[Config Error] Missing or empty environment variable: ${key}`);
        }
        return val;
    }

    get llmModel(): string {
        const provider = this.llmProvider;
        if (provider === "google") return this.getOrThrow("GOOGLE_LLM_MODEL");
        if (provider === "openai") return this.getOrThrow("OPENAI_LLM_MODEL");
        return this.getOrThrow("OLLAMA_LLM_MODEL");
    }

    get embeddingModel(): string {
        const provider = this.llmProvider;
        if (provider === "google") return this.googleEmbeddingModel;
        if (provider === "openai") return this.openaiEmbeddingModel;
        return this.ollamaEmbeddingModel;
    }

    get vectorStoreType(): "json" | "mongodb" {
        const val = this.getOrThrow("APP_VECTOR_STORE");
        if (val !== "json" && val !== "mongodb") {
            throw new Error(`[Config Error] APP_VECTOR_STORE must be 'json' or 'mongodb'. Got: '${val}'`);
        }
        return val as "json" | "mongodb";
    }

    get dataDir(): string {
        return this.getOrThrow("APP_DATA_DIR");
    }

    get jsonStoragePath(): string {
        // Derived path, keeps it consistent
        return path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");
    }

    get mongoUri(): string {
        return this.getOrThrow("MONGODB_URI");
    }

    get mongoDbName(): string {
        return this.getOrThrow("MONGODB_DB_NAME");
    }

    get mongoCollectionName(): string {
        return this.getOrThrow("MONGODB_COLLECTION");
    }

    get mongoIndexName(): string {
        return this.getOrThrow("MONGODB_VECTOR_INDEX");
    }

    get llmProvider(): string {
        return this.getOrThrow("APP_LLM_PROVIDER");
    }

    get googleApiKey(): string {
        return this.getOrThrow("GOOGLE_API_KEY");
    }

    get googleModel(): string {
        return this.getOrThrow("GOOGLE_LLM_MODEL");
    }

    get googleEmbeddingModel(): string {
        return this.getOrThrow("GOOGLE_EMBEDDING_MODEL");
    }

    get ollamaBaseUrl(): string {
        return this.getOrThrow("OLLAMA_BASE_URL");
    }

    get ollamaEmbeddingModel(): string {
        return this.getOrThrow("OLLAMA_EMBEDDING_MODEL");
    }

    get openaiApiKey(): string {
        return this.getOrThrow("OPENAI_API_KEY");
    }

    get openaiModel(): string {
        return this.getOrThrow("OPENAI_LLM_MODEL");
    }

    get openaiEmbeddingModel(): string {
        return this.getOrThrow("OPENAI_EMBEDDING_MODEL");
    }
}
