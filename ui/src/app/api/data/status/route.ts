import { NextRequest, NextResponse } from "next/server";
import { IngestionService } from "@/lib/backend/application/IngestionService";
import { ConfigService } from "@/lib/backend/core/config/ConfigService";
import { EmbeddingModelFactory } from "@/lib/backend/infrastructure/factories/EmbeddingModelFactory";
import { VectorStoreFactory } from "@/lib/backend/infrastructure/factories/VectorStoreFactory";
import { getSessionId } from "@/lib/backend/utils/sessionUtils";
import fs from "fs";

export async function GET(req: NextRequest) {
    try {
        const sessionId = getSessionId(req);
        const config = ConfigService.getInstance();
        const embeddings = EmbeddingModelFactory.create(config);
        const vectorStore = await VectorStoreFactory.create(config, embeddings);
        const ingestionService = new IngestionService(vectorStore);

        const sessionDir = ingestionService.getSessionDir(sessionId);
        const isEmpty = !fs.existsSync(sessionDir) || fs.readdirSync(sessionDir).length === 0;

        return NextResponse.json({ isEmpty, sessionDir });
    } catch (error: any) {
        console.error("Session Status API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
