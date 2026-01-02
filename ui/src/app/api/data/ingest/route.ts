import { NextRequest, NextResponse } from "next/server";
import { ConfigService } from "@/lib/backend/core/config/ConfigService";
import { EmbeddingModelFactory } from "@/lib/backend/infrastructure/factories/EmbeddingModelFactory";
import { VectorStoreFactory } from "@/lib/backend/infrastructure/factories/VectorStoreFactory";
import { IngestionService } from "@/lib/backend/application/IngestionService";
import { getSessionId } from "@/lib/backend/utils/sessionUtils";

export async function POST(req: NextRequest) {
    try {
        const sessionId = getSessionId(req);
        const config = ConfigService.getInstance();
        const embeddings = EmbeddingModelFactory.create(config);
        const vectorStore = await VectorStoreFactory.create(config, embeddings);
        const ingestionService = new IngestionService(vectorStore);

        await ingestionService.ingestDirectory(sessionId);
        return NextResponse.json({ message: "Directory sync completed successfully" });
    } catch (error: any) {
        console.error("Ingest API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
