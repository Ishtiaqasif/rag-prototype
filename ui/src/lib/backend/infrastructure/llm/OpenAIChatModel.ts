import { ChatOpenAI } from "@langchain/openai";
import { IChatModel } from "../../core/interfaces/IChatModel";

export class OpenAIChatModel implements IChatModel {
    private model: ChatOpenAI;

    constructor(apiKey: string, modelName: string = "gpt-4o", temperature: number = 0.7) {
        this.model = new ChatOpenAI({
            openAIApiKey: apiKey,
            modelName: modelName,
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
