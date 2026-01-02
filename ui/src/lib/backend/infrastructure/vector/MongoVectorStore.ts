import { MongoClient, Collection } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { IVectorStore } from "../../core/interfaces/IVectorStore";
import { Document } from "../../core/entities/Document";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";
import { OllamaEmbeddings } from "@langchain/ollama";

export class MongoVectorStore implements IVectorStore {
    private client: MongoClient;
    private collection: Collection;
    private vectorStore: MongoDBAtlasVectorSearch;
    private embeddings: IEmbeddings;

    constructor(
        client: MongoClient,
        collection: Collection,
        embeddings: IEmbeddings,
        config: { indexName: string, textKey: string, embeddingKey: string }
    ) {
        this.client = client;
        this.collection = collection;
        this.embeddings = embeddings;

        // We need to cast embeddings to any or specific type expected by langchain if slightly different,
        // but since OllamaClient implements IEmbeddings which matches, it should be ok IF the underlying lib accepts it.
        // However, MongoDBAtlasVectorSearch expects LangChain Embeddings interface.
        // Our OllamaClient WRAPS it. Ideally we pass the real langchain embeddings object if possible,
        // OR we make our IEmbeddings compatible.
        // For simplicity here, I will instantiate a fresh OllamaEmbeddings or pass it in if I change the interface.
        // Let's assume for now we pass the UNDERLYING embeddings object to the lib, or we bridge it.

        // Actually, looking at `ingest.ts`, it uses `OllamaEmbeddings` directly.
        // Our `IEmbeddings` is a custom interface. 
        // To interact with `MongoDBAtlasVectorSearch`, we need an object that satisfies `EmbeddingsInterface` from `@langchain/core/embeddings`.
        // Our `OllamaClient` HAS an `embeddings` property which IS that object.
        // But `MongoVectorStore` shouldn't depend on concrete `OllamaClient`.
        // FIX: Let's assume for this specific implementation we might need to cast or adapt.
        // For now, I'll construct a compatible object or expect the caller to pass compatible embeddings.

        // Simpler approach: Create a temporary adapter if needed.
        const embeddingsAdapter = {
            embedQuery: (text: string) => embeddings.embedQuery(text),
            embedDocuments: (texts: string[]) => embeddings.embedDocuments(texts),
        };

        this.vectorStore = new MongoDBAtlasVectorSearch(embeddingsAdapter as any, {
            collection: collection as any,
            indexName: config.indexName,
            textKey: config.textKey,
            embeddingKey: config.embeddingKey,
        });
    }

    async addDocuments(documents: Document[]): Promise<void> {
        // MongoDBAtlasVectorSearch expects documents with `pageContent` and `metadata`.
        // It handles embedding internally if passed to `addDocuments`, 
        // OR we can add vectors manually if we used a lower level approach.
        // `vectorStore.addDocuments` takes `Document[]` from langchain.
        // Our `Document` entity is compatible.

        // We might want to ensure vectors are present? No, the LC store handles embedding generation usually.
        // But wait, `ingest.ts` line 105: `new MongoDBAtlasVectorSearch(embeddings, ...)`
        // And then `vectorStore.addDocuments(splitDocs)`.

        // We need to map our Core Document to LangChain Document
        const lcDocs = documents.map(d => ({
            pageContent: d.pageContent,
            metadata: d.metadata
        }));

        await this.vectorStore.addDocuments(lcDocs);
    }

    async similaritySearch(query: string, k: number, filter?: Record<string, any>): Promise<Document[]> {
        // MongoDB Atlas Vector Search requires indexed fields for pre-filtering
        // To avoid index requirements, we'll do post-filtering instead
        // Retrieve more results and filter in application code
        const retrievalMultiplier = filter ? 3 : 1;
        const results = await this.vectorStore.similaritySearch(query, k * retrievalMultiplier);

        let filteredResults = results;

        // Apply filter if provided
        if (filter) {
            filteredResults = results.filter(doc => {
                for (const key in filter) {
                    if (doc.metadata[key] !== filter[key]) {
                        return false;
                    }
                }
                return true;
            });
        }

        // Return top k results after filtering
        return filteredResults.slice(0, k).map(r => ({
            pageContent: r.pageContent,
            metadata: r.metadata,
        }));
    }

    async deleteDocuments(filter: Record<string, any>): Promise<void> {
        // MongoDBAtlasVectorSearch stores metadata fields at the root of the document based on our observation
        // or passing them directly.
        await this.collection.deleteMany(filter);
    }

    async exists(filter: Record<string, any>): Promise<boolean> {
        const result = await this.collection.findOne(filter);
        return !!result;
    }

    async close() {
        await this.client.close();
    }
}
