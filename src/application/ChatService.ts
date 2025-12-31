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
        const docs = await this.vectorStore.similaritySearch(question, 10);
        const context = this.formatContext(docs);

        // 2. Construct prompt
        const prompt = `Answer the question based only on the following context:
${context}

Question: ${question}

Answer:`;

        // 3. Stream response
        return this.llm.stream(prompt);
    }
}
