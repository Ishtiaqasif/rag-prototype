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

        const contentType = req.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("file") as File;

            if (!file) {
                return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = file.name;
            const tempPath = `./temp_${sessionId}_${fileName}`;

            const fs = require("fs");
            fs.writeFileSync(tempPath, buffer);

            try {
                if (fileName.toLowerCase().endsWith(".zip")) {
                    await ingestionService.ingestZip(tempPath, sessionId);
                } else {
                    await ingestionService.ingestFile(tempPath, sessionId);
                }
            } finally {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            }

            return NextResponse.json({ message: `${fileName} ingested successfully` });

        } else {
            const { text, name } = await req.json();

            if (!text) {
                return NextResponse.json({ error: "Text content is required" }, { status: 400 });
            }

            await ingestionService.ingestSingleCV(text, name || "raw_text_input", sessionId);
            return NextResponse.json({ message: "Text content ingested successfully" });
        }

    } catch (error: any) {
        console.error("Ingest Single API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
