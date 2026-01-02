import { MongoClient } from "mongodb";
import { ConfigService } from "../../core/config/ConfigService";
import { IEmbeddings } from "../../core/interfaces/IEmbeddings";
import { IVectorStore } from "../../core/interfaces/IVectorStore";
import { JsonVectorStore } from "../vector/JsonVectorStore";
import { MongoVectorStore } from "../vector/MongoVectorStore";

export class VectorStoreFactory {
    static async create(config: ConfigService, embeddings: IEmbeddings): Promise<IVectorStore> {
        const storeType = config.vectorStoreType;

        if (storeType === "json") {
            return new JsonVectorStore(embeddings, config.jsonStoragePath);

        } else if (storeType === "mongodb") {
            const mongoClient = new MongoClient(config.mongoUri);
            await mongoClient.connect();
            const collection = mongoClient.db(config.mongoDbName).collection(config.mongoCollectionName);

            return new MongoVectorStore(mongoClient, collection, embeddings, {
                indexName: config.mongoIndexName,
                textKey: "text",
                embeddingKey: "embedding"
            });

        } else {
            throw new Error(`Unsupported Vector Store Type: ${storeType}`);
        }
    }
}
