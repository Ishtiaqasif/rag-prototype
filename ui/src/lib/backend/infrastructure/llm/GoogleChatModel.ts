import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { IChatModel } from "../../core/interfaces/IChatModel";

export class GoogleChatModel implements IChatModel {
    private model: ChatGoogleGenerativeAI;

    constructor(apiKey: string, modelName: string, temperature: number = 0.7) {
        this.model = new ChatGoogleGenerativeAI({
            apiKey: apiKey,
            model: modelName,
            temperature: temperature,
        });
    }

    async invoke(prompt: string): Promise<string> {
        const response = await this.model.invoke(prompt);
        return response.content.toString();
    }

    async *stream(prompt: string): AsyncGenerator<string> {
        const stream = await this.model.stream(prompt);
        for await (const chunk of stream) {
            yield chunk.content.toString();
        }
    }
}
