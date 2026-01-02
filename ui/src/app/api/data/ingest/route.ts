import { NextRequest, NextResponse } from "next/server";
import { ConfigService } from "@/lib/backend/core/config/ConfigService";
import { EmbeddingModelFactory } from "@/lib/backend/infrastructure/factories/EmbeddingModelFactory";
import { VectorStoreFactory } from "@/lib/backend/infrastructure/factories/VectorStoreFactory";
import { IngestionService } from "@/lib/backend/application/IngestionService";

export async function POST(req: NextRequest) {
    try {
        const config = ConfigService.getInstance();
        const embeddings = EmbeddingModelFactory.create(config);
        const vectorStore = await VectorStoreFactory.create(config, embeddings);
        const ingestionService = new IngestionService(vectorStore);

        await ingestionService.ingestDirectory(config.dataDir);

        return NextResponse.json({ message: "Directory ingestion completed successfully" });
    } catch (error: any) {
        console.error("Ingest API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
