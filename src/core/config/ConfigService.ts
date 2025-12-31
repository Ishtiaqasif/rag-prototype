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
        return this.getOrThrow("LLM_MODEL");
    }

    get embeddingModel(): string {
        return this.getOrThrow("EMBEDDING_MODEL");
    }

    get vectorStoreType(): "json" | "mongodb" {
        const val = this.getOrThrow("VECTOR_STORE");
        if (val !== "json" && val !== "mongodb") {
            throw new Error(`[Config Error] VECTOR_STORE must be 'json' or 'mongodb'. Got: '${val}'`);
        }
        return val as "json" | "mongodb";
    }

    get dataDir(): string {
        return this.getOrThrow("DATA_DIR");
    }

    get jsonStoragePath(): string {
        // Derived path, keeps it consistent
        return path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");
    }

    get mongoUri(): string {
        return this.getOrThrow("MONGODB_ATLAS_URI");
    }

    get mongoDbName(): string {
        return this.getOrThrow("MONGODB_DB_NAME");
    }

    get mongoCollectionName(): string {
        return this.getOrThrow("MONGODB_COLLECTION_NAME");
    }

    get mongoIndexName(): string {
        return this.getOrThrow("MONGODB_INDEX_NAME");
    }

    get ollamaBaseUrl(): string {
        return this.getOrThrow("OLLAMA_BASE_URL");
    }
}
