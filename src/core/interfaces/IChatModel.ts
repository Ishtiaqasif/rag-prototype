export interface IChatModel {
    invoke(prompt: string): Promise<string>;
    stream(prompt: string): AsyncGenerator<string>;
}
