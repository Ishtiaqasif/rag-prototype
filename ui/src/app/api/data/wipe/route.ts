import { NextRequest, NextResponse } from "next/server";
import { ConfigService } from "@/lib/backend/core/config/ConfigService";
import { EmbeddingModelFactory } from "@/lib/backend/infrastructure/factories/EmbeddingModelFactory";
import { VectorStoreFactory } from "@/lib/backend/infrastructure/factories/VectorStoreFactory";

export async function POST(req: NextRequest) {
    try {
        const config = ConfigService.getInstance();
        const embeddings = EmbeddingModelFactory.create(config);
        const vectorStore = await VectorStoreFactory.create(config, embeddings);

        await vectorStore.deleteDocuments({});

        return NextResponse.json({ message: "Database wiped successfully" });
    } catch (error: any) {
        console.error("Wipe API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
