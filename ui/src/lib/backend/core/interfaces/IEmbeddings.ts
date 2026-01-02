export interface IEmbeddings {
    embedQuery(text: string): Promise<number[]>;
    embedDocuments(texts: string[]): Promise<number[][]>;
}
