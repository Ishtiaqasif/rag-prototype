import { OpenAIEmbeddings as LangChainOpenAIEmbeddings } from "@langchain/openai";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";

export class OpenAIEmbeddings implements IEmbeddings {
    private model: LangChainOpenAIEmbeddings;

    constructor(apiKey: string, modelName: string) {
        this.model = new LangChainOpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: modelName,
        });
    }

    async embedQuery(text: string): Promise<number[]> {
        return this.model.embedQuery(text);
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        return this.model.embedDocuments(texts);
    }
}
