import { NextRequest, NextResponse } from "next/server";
import { ConfigService } from "@/lib/backend/core/config/ConfigService";
import { EmbeddingModelFactory } from "@/lib/backend/infrastructure/factories/EmbeddingModelFactory";
import { VectorStoreFactory } from "@/lib/backend/infrastructure/factories/VectorStoreFactory";
import { ChatModelFactory } from "@/lib/backend/infrastructure/factories/ChatModelFactory";
import { ChatService } from "@/lib/backend/application/ChatService";
import { getSessionId } from "@/lib/backend/utils/sessionUtils";

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const sessionId = getSessionId(req);
        const config = ConfigService.getInstance();
        const embeddings = EmbeddingModelFactory.create(config);
        const vectorStore = await VectorStoreFactory.create(config, embeddings);
        const llm = ChatModelFactory.create(config);
        const chatService = new ChatService(vectorStore, llm);

        const response = await chatService.ask(message, sessionId);

        return NextResponse.json({ response });
    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
