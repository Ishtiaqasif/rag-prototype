import { IVectorStore } from "../core/interfaces/IVectorStore";
import { IChatModel } from "../core/interfaces/IChatModel";
import path from "path";

export class RecruiterService {
    private vectorStore: IVectorStore;
    private llm: IChatModel;
    private jobDescription: string = "";

    constructor(vectorStore: IVectorStore, llm: IChatModel) {
        this.vectorStore = vectorStore;
        this.llm = llm;
    }

    setJobDescription(jd: string) {
        this.jobDescription = jd;
    }

    private getDiversityDocs(docs: any[], count: number = 5): any[] {
        const uniqueSources = new Set<string>();
        const diverseDocs = [];

        for (const doc of docs) {
            const source = doc.metadata.source;
            if (!uniqueSources.has(source)) {
                uniqueSources.add(source);
                diverseDocs.push(doc);
            }
            if (diverseDocs.length >= count) break;
        }
        return diverseDocs;
    }

    private formatDocuments(documents: any[]): string {
        return documents.map((doc) => {
            const filename = path.basename(doc.metadata.source || "unknown");
            return `--- Candidate File: ${filename} ---\n${doc.pageContent}\n----------------`;
        }).join("\n\n");
    }

    async ask(question: string): Promise<AsyncGenerator<string>> {
        // 1. Retrieve (Fetch more to ensure diversity)
        // Mix query with JD for better semantic match (as per original logic)
        const searchQuery = `${question} ${this.jobDescription}`;
        const retrievedDocs = await this.vectorStore.similaritySearch(searchQuery, 20);

        // 2. Filter for diversity
        const diverseDocs = this.getDiversityDocs(retrievedDocs, 5);
        const context = this.formatDocuments(diverseDocs);

        // 3. Construct prompt
        const prompt = `You are an expert AI Recruiter aiding a hiring manager.
    
JOB DESCRIPTION:
${this.jobDescription}

CANDIDATE DATA (Retrieved chunks from CVs):
${context}

Based on the JD and the candidate data provided:
- Analyze the candidates.
- Answer the user's question.
- Always cite the candidate's filename or name.

Question: ${question}
Answer:`;

        // 4. Stream response
        return this.llm.stream(prompt);
    }
}
