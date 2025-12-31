import { Document } from "../entities/Document";

export interface IVectorStore {
    addDocuments(documents: Document[]): Promise<void>;
    similaritySearch(query: string, k: number): Promise<Document[]>;
    deleteDocuments(filter: Record<string, any>): Promise<void>;
    exists(filter: Record<string, any>): Promise<boolean>;
}
