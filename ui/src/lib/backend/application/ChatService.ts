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

    async ask(question: string): Promise<string> {
        // 1. Retrieve context
        const docs = await this.vectorStore.similaritySearch(question, 10);
        const context = this.formatContext(docs);

        // 2. Construct prompt
        const prompt = `You are the AI Recruiter Assistant, a specialized tool designed to help hiring managers analyze candidate CVs/resumes against user queries, as datasouce we have a cv-bank. Your purpose is to provide data-driven insights, shortlist relevant profiles, and answer specific questions about candidates using only the provided context.

Communication Guidelines:

Professional & Precise: Maintain a formal yet helpful recruitment professional tone.
Context-First: Base all candidate-specific claims strictly on the provided CV chunks. If information is missing, clearly state that it's not present.
Concise Responses: Provide structured and scannable answers (bullet points are preferred for comparisons).
Cite Sources: Always mention the candidate's filename or name when discussing their profile.
Generic Polish: You can handle greetings and basic assistant interactions politely, but always steer back to the recruitment task.
No Hallucinations: Do not invent skills, experience, or qualifications..

CONTEXT:
${context}

User Question: ${question}

Answer:`;

        // 3. Stream response
        console.log("prompt: ", prompt);
        return this.llm.invoke(prompt);
    }
}
