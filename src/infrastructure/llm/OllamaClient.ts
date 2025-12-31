import { OllamaEmbeddings } from "@langchain/ollama";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";

export class OllamaClient implements IEmbeddings {
    private embeddings: OllamaEmbeddings;

    constructor(modelName: string = "llama3.2:latest") {
        this.embeddings = new OllamaEmbeddings({
            model: modelName,
        });
    }

    async embedQuery(text: string): Promise<number[]> {
        return this.embeddings.embedQuery(text);
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        return this.embeddings.embedDocuments(texts);
    }
}
