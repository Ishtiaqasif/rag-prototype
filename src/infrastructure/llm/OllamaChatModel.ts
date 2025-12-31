import { ChatOllama } from "@langchain/ollama";
import { IChatModel } from "../../core/interfaces/IChatModel";

export class OllamaChatModel implements IChatModel {
    private model: ChatOllama;

    constructor(modelName: string = "llama3", temperature: number = 0.2) {
        this.model = new ChatOllama({
            model: modelName,
            temperature: temperature,
        });
    }

    async invoke(prompt: string): Promise<string> {
        const response = await this.model.invoke(prompt);
        // ChatOllama returns a BaseMessage or string depending on config?
        // Typically it returns BaseMessage chunk.
        return response.content.toString();
    }

    async *stream(prompt: string): AsyncGenerator<string> {
        const stream = await this.model.stream(prompt);
        for await (const chunk of stream) {
            yield chunk.content.toString();
        }
    }
}
