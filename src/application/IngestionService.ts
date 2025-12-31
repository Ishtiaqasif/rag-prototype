import fs from "fs";
import path from "path";
import crypto from "crypto";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { IVectorStore } from "../core/interfaces/IVectorStore";
import { Document } from "../core/entities/Document";

export class IngestionService {
    private vectorStore: IVectorStore;

    constructor(vectorStore: IVectorStore) {
        this.vectorStore = vectorStore;
    }

    private extractEmail(text: string): string | null {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = text.match(emailRegex);
        return match ? match[0].toLowerCase() : null;
    }

    private generateId(email: string, content: string, index: number): string {
        const hash = crypto.createHash("sha256").update(`${email}:${content}:${index}`).digest("hex");
        return [
            hash.substring(0, 8),
            hash.substring(8, 12),
            hash.substring(12, 16),
            hash.substring(16, 20),
            hash.substring(20, 32)
        ].join("-");
    }

    async ingestDirectory(dataDir: string): Promise<void> {
        console.log(`Loading files from: ${dataDir}`);
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".txt") || f.endsWith(".pdf"));

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 2000,
            chunkOverlap: 200,
        });

        for (const file of files) {
            const filePath = path.join(dataDir, file);
            console.log(`\nProcessing: ${file}`);

            try {
                const loader = file.endsWith(".pdf") ? new PDFLoader(filePath) : new TextLoader(filePath);
                const docs = await loader.load();
                const fullContent = docs.map((d: any) => d.pageContent).join("\n");
                const contentHash = crypto.createHash("sha256").update(fullContent).digest("hex");

                const email = this.extractEmail(fullContent);
                if (!email) {
                    console.warn(`Could not find email in ${file}. Skipping.`);
                    continue;
                }

                const alreadyUpToDate = await this.vectorStore.exists({
                    email: email,
                    contentHash: contentHash
                });

                if (alreadyUpToDate) {
                    console.log(`Skipping ${file}: Data for ${email} is already up to date.`);
                    continue;
                }

                console.log(`Changes detected for ${email}. Updating...`);
                await this.vectorStore.deleteDocuments({ email: email });

                const splitDocs = await splitter.splitDocuments(docs);
                const documents: Document[] = splitDocs.map((doc: any, i: number) => ({
                    pageContent: doc.pageContent,
                    metadata: {
                        ...doc.metadata,
                        email,
                        contentHash,
                        source: file
                    },
                    id: this.generateId(email, doc.pageContent, i)
                }));

                // Note: ID handling might need to be passed to store specifically if store supports it.
                // Our Document entity has ID.
                // JsonVectorStore might ignore ID unless we save it.
                // Mongo store will separate ID.

                await this.vectorStore.addDocuments(documents);
                console.log(`Ingested ${documents.length} chunks for ${email}.`);

            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
    }
}
