import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";
import { TaskType } from "@google/generative-ai";

export class GoogleEmbeddings implements IEmbeddings {
    private model: GoogleGenerativeAIEmbeddings;

    constructor(apiKey: string, modelName: string) {
        this.model = new GoogleGenerativeAIEmbeddings({
            apiKey: apiKey,
            model: modelName,
            taskType: TaskType.RETRIEVAL_DOCUMENT,
        });
    }

    async embedQuery(text: string): Promise<number[]> {
        return this.model.embedQuery(text);
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        return this.model.embedDocuments(texts);
    }
}
