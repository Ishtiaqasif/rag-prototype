import { OllamaEmbeddings } from "@langchain/ollama";
import { IEmbeddings } from "../../../core/interfaces/IEmbeddings";

export class OllamaEmbeddingsWrapper implements IEmbeddings {
    private embeddings: OllamaEmbeddings;

    constructor(modelName: string) {
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
