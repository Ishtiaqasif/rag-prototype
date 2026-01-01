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

    private extractName(text: string): string {
        // Simple heuristic: First few non-empty lines often contain the name
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
            // Take the first line as a potential name if it's not too long and doesn't look like an email/address
            const firstLine = lines[0];
            if (firstLine.length < 50 && !firstLine.includes("@")) {
                return firstLine;
            }
        }
        return "Not Found";
    }

    private extractAddress(text: string): string {
        // Look for common address keywords or patterns
        const lines = text.split("\n").map(l => l.trim());
        const addressKeywords = ["Street", "Avenue", "Road", "Rd", "St", "Ave", "Drive", "Dr", "Lane", "Ln", "City", "State", "Zip", "Country"];
        for (const line of lines) {
            if (addressKeywords.some(kw => line.includes(kw)) && line.length < 100) {
                return line;
            }
        }
        return "Not Found";
    }

    private extractJobRole(text: string): string {
        // Look for common job titles or headings
        const roleKeywords = ["Software Engineer", "Developer", "Manager", "Analyst", "Lead", "Architect", "Designer", "Consultant"];
        const lines = text.split("\n").map(l => l.trim());
        for (const line of lines) {
            if (roleKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase())) && line.length < 60) {
                return line;
            }
        }
        return "Not Found";
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

                // Check if any data exists for this email (ignoring hash) to distinguish Update vs New
                const isUpdate = await this.vectorStore.exists({ email: email });

                if (isUpdate) {
                    console.log(`Changes detected for ${email}. Updating...`);
                    await this.vectorStore.deleteDocuments({ email: email });
                } else {
                    console.log(`New candidate detected: ${email}. Ingesting...`);
                }

                const name = this.extractName(fullContent);
                const address = this.extractAddress(fullContent);
                const role = this.extractJobRole(fullContent);

                const splitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1000,
                    chunkOverlap: 200,
                    separators: ["\n----------------\n", "\nSECTION\n", "\n\n", "\n", " "]
                });

                const splitDocs = await splitter.splitDocuments(docs);
                const documents: Document[] = splitDocs.map((doc, i) => {
                    const enrichedContent = `CANDIDATE IDENTITY: ${email}\nFULL NAME: ${name}\nADDRESS: ${address}\nJOB ROLE: ${role}\n\n--- SECTION CONTENT ---\n${doc.pageContent}`;

                    return {
                        pageContent: enrichedContent,
                        metadata: {
                            email,
                            name,
                            role,
                            contentHash,
                            source: file
                        },
                        id: this.generateId(email, doc.pageContent, i)
                    };
                });

                await this.vectorStore.addDocuments(documents);
                console.log(`Ingested ${documents.length} enriched chunks for ${email}.`);

            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
    }
}
