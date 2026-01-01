import { IVectorStore } from "../core/interfaces/IVectorStore";
import { IChatModel } from "../core/interfaces/IChatModel";

export class ChatService {
    private vectorStore: IVectorStore;
    private llm: IChatModel;

    constructor(vectorStore: IVectorStore, llm: IChatModel) {
        this.vectorStore = vectorStore;
        this.llm = llm;
    }

    private formatContext(documents: any[]): string {
        return documents.map(doc => doc.pageContent).join("\n\n");
    }

    async ask(question: string): Promise<AsyncGenerator<string>> {
        // 1. Retrieve context
        const docs = await this.vectorStore.similaritySearch(question, 5);
        const context = this.formatContext(docs);

        // 2. Construct prompt
        const prompt = `You are a helpful AI assistant.
Answer the user's question purely based on the context provided below.
If the answer is not present in the context, strictly state "I don't know" or "I cannot answer based on the provided documents".
Do not make up information.

CONTEXT:
${context}

User Question: ${question}

Answer:`;

        // 3. Stream response
        return this.llm.stream(prompt);
    }
}
