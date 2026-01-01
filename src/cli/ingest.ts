import { IngestionService } from "../application/IngestionService";
import { ConfigService } from "../core/config/ConfigService";
import { VectorStoreFactory } from "../infrastructure/factories/VectorStoreFactory";
import { EmbeddingModelFactory } from "../infrastructure/factories/EmbeddingModelFactory";

async function main() {
    const config = ConfigService.getInstance();

    console.log(`Starting Ingestion (Store: ${config.vectorStoreType})...`);

    // Use Factory for embeddings
    const embeddings = EmbeddingModelFactory.create(config);

    // Usage of Factory Pattern
    const vectorStore = await VectorStoreFactory.create(config, embeddings);

    try {
        const service = new IngestionService(vectorStore);
        await service.ingestDirectory(config.dataDir);
        console.log("Ingestion complete.");
    } catch (error) {
        console.error("Ingestion failed:", error);
    } finally {
        // Polymorphic cleanup
        await vectorStore.close();
    }
}

main().catch(console.error);
