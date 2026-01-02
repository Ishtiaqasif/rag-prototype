import fs from "fs";
import path from "path";
import { IVectorStore } from "../../core/interfaces/IVectorStore";
import { Document } from "../../core/entities/Document";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";

export class JsonVectorStore implements IVectorStore {
    private storagePath: string;
    private embeddings: IEmbeddings;

    constructor(embeddings: IEmbeddings, storagePath: string) {
        this.embeddings = embeddings;
        this.storagePath = storagePath;
        this.ensureFile();
    }

    private ensureFile() {
        if (!fs.existsSync(path.dirname(this.storagePath))) {
            fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
        }
        if (!fs.existsSync(this.storagePath)) {
            fs.writeFileSync(this.storagePath, JSON.stringify([], null, 2));
        }
    }

    private readData(): Document[] {
        if (!fs.existsSync(this.storagePath)) return [];
        const content = fs.readFileSync(this.storagePath, "utf-8");
        return JSON.parse(content);
    }

    private writeData(data: Document[]) {
        fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async addDocuments(documents: Document[]): Promise<void> {
        const data = this.readData();

        // Compute embeddings if missing (though they should typically be passed or handled by service)
        // Here we assume documents might need embedding if not present, but our interface defines 
        // Document having optional vector. Ideally, the service calling this should handle embedding 
        // OR this store embeds. Let's assume passed documents MIGHT NOT have vectors, so we embed them.

        const docsWithVectors = await Promise.all(documents.map(async doc => {
            if (!doc.vector) {
                doc.vector = await this.embeddings.embedQuery(doc.pageContent);
            }
            return doc;
        }));

        this.writeData([...data, ...docsWithVectors]);
    }

    async similaritySearch(query: string, k: number, filter?: Record<string, any>): Promise<Document[]> {
        let data = this.readData();

        // Apply filter if provided
        if (filter) {
            data = data.filter(doc => {
                for (const key in filter) {
                    if (doc.metadata[key] !== filter[key]) {
                        return false;
                    }
                }
                return true;
            });
        }

        const queryVector = await this.embeddings.embedQuery(query);

        return data
            .map(doc => ({
                ...doc,
                score: doc.vector ? this.cosineSimilarity(queryVector, doc.vector) : 0
            }))
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, k)
            .map(doc => {
                const { score, ...rest } = doc as any; // Remove score from returned object
                return rest as Document;
            });
    }

    async deleteDocuments(filter: Record<string, any>): Promise<void> {
        let data = this.readData();
        data = data.filter(doc => {
            // Check if doc matches filter. If ANY filter key matches, we drop it? 
            // Usually filter implies AND on keys. return FALSE to delete.
            for (const key in filter) {
                if (doc.metadata[key] !== filter[key]) {
                    return true; // Keep if mismatch
                }
            }
            return false; // Drop if all match
        });
        this.writeData(data);
    }

    async exists(filter: Record<string, any>): Promise<boolean> {
        const data = this.readData();
        return data.some(doc => {
            for (const key in filter) {
                if (doc.metadata[key] !== filter[key]) {
                    return false;
                }
            }
            return true;
        });
    }

    async close(): Promise<void> {
        // No-op for JSON store
        return Promise.resolve();
    }
}
