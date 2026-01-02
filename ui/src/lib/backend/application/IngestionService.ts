import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { IVectorStore } from "../core/interfaces/IVectorStore";
import { Document } from "../core/entities/Document";

export class IngestionService {
    private vectorStore: IVectorStore;
    private sessionsBaseDir: string;

    constructor(vectorStore: IVectorStore) {
        this.vectorStore = vectorStore;
        this.sessionsBaseDir = path.join(process.cwd(), "data", "sessions");
    }

    private ensureSessionDir(sessionId: string): string {
        const sessionDir = path.join(this.sessionsBaseDir, sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        return sessionDir;
    }

    public getSessionDir(sessionId: string): string {
        return this.ensureSessionDir(sessionId);
    }

    private extractEmail(text: string): string | null {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = text.match(emailRegex);
        return match ? match[0].toLowerCase() : null;
    }

    private extractName(text: string): string {
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
            const firstLine = lines[0];
            if (firstLine.length < 50 && !firstLine.includes("@")) {
                return firstLine;
            }
        }
        return "Not Found";
    }

    private extractAddress(text: string): string {
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
        const roleKeywords = ["Software Engineer", "Developer", "Manager", "Analyst", "Lead", "Architect", "Designer", "Consultant"];
        const lines = text.split("\n").map(l => l.trim());
        for (const line of lines) {
            if (roleKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase())) && line.length < 60) {
                return line;
            }
        }
        return "Not Found";
    }

    private generateId(email: string, content: string, index: number, sessionId: string): string {
        const hash = crypto.createHash("sha256").update(`${sessionId}:${email}:${content}:${index}`).digest("hex");
        return [
            hash.substring(0, 8),
            hash.substring(8, 12),
            hash.substring(12, 16),
            hash.substring(16, 20),
            hash.substring(20, 32)
        ].join("-");
    }

    async ingestSingleCV(fullContent: string, sourceName: string, sessionId: string): Promise<void> {
        const contentHash = crypto.createHash("sha256").update(fullContent).digest("hex");

        const email = this.extractEmail(fullContent);
        if (!email) {
            throw new Error(`Could not find email in candidate data (${sourceName}).`);
        }

        const alreadyUpToDate = await this.vectorStore.exists({
            sessionId: sessionId,
            email: email,
            contentHash: contentHash
        });

        if (alreadyUpToDate) {
            console.log(`Skipping: Data for ${email} in session ${sessionId} is already up to date.`);
            return;
        }

        const isUpdate = await this.vectorStore.exists({ sessionId, email: email });
        if (isUpdate) {
            console.log(`Changes detected for ${email} in session ${sessionId}. Updating...`);
            await this.vectorStore.deleteDocuments({ sessionId, email: email });
        }

        const name = this.extractName(fullContent);
        const address = this.extractAddress(fullContent);
        const role = this.extractJobRole(fullContent);

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: ["\n----------------\n", "\nSECTION\n", "\n\n", "\n", " "]
        });

        const splitDocs = await splitter.splitText(fullContent);

        const documents: Document[] = splitDocs.map((chunk, i) => {
            const enrichedContent = `CANDIDATE IDENTITY: ${email}\nFULL NAME: ${name}\nADDRESS: ${address}\nJOB ROLE: ${role}\n\n--- SECTION CONTENT ---\n${chunk}`;

            return {
                pageContent: enrichedContent,
                metadata: {
                    sessionId,
                    email,
                    name,
                    role,
                    contentHash,
                    source: sourceName
                },
                id: this.generateId(email, chunk, i, sessionId)
            };
        });

        await this.vectorStore.addDocuments(documents);
        console.log(`Ingested ${documents.length} chunks for ${email} in session ${sessionId}.`);
    }

    async ingestFile(filePath: string, sessionId: string): Promise<void> {
        const file = path.basename(filePath);
        const loader = file.endsWith(".pdf") ? new PDFLoader(filePath) : new TextLoader(filePath);
        const docs = await loader.load();
        const fullContent = docs.map((d: any) => d.pageContent).join("\n");

        // Save to session dir if it's not already there
        const sessionDir = this.ensureSessionDir(sessionId);
        const targetPath = path.join(sessionDir, file);
        if (filePath !== targetPath) {
            fs.copyFileSync(filePath, targetPath);
        }

        await this.ingestSingleCV(fullContent, file, sessionId);
    }

    async ingestZip(zipPath: string, sessionId: string): Promise<void> {
        const zip = new AdmZip(zipPath);
        const tempDir = path.join(path.dirname(zipPath), `extracted_${path.basename(zipPath, ".zip")}`);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        try {
            zip.extractAllTo(tempDir, true);
            await this.ingestDirectoryRecursive(tempDir, sessionId);
        } finally {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    }

    private async ingestDirectoryRecursive(dir: string, sessionId: string): Promise<void> {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                await this.ingestDirectoryRecursive(fullPath, sessionId);
            } else if (item.endsWith(".txt") || item.endsWith(".pdf")) {
                try {
                    await this.ingestFile(fullPath, sessionId);
                } catch (err) {
                    console.error(`Error processing file ${item} in session ${sessionId}:`, err);
                }
            }
        }
    }

    async ingestDirectory(sessionId: string): Promise<void> {
        const sessionDir = this.ensureSessionDir(sessionId);
        console.log(`Syncing session directory: ${sessionDir}`);
        await this.ingestDirectoryRecursive(sessionDir, sessionId);
    }

    async cleanupSession(sessionId: string, storageType: "json" | "mongodb" = "mongodb"): Promise<void> {
        console.log(`[CLEANUP] Starting cleanup for session: ${sessionId}, storage: ${storageType}`);

        // 1. Wipe vector store based on storage type
        if (storageType === "json") {
            // For JSON storage, delete the embeddings file
            const jsonPath = path.join(process.cwd(), "data", "json-embeddings", "embeddings.json");
            console.log(`[CLEANUP] Deleting JSON embeddings file: ${jsonPath}`);
            if (fs.existsSync(jsonPath)) {
                fs.unlinkSync(jsonPath);
                console.log(`[CLEANUP] JSON embeddings file deleted`);
            }
        } else {
            // For MongoDB, delete documents by sessionId
            console.log(`[CLEANUP] Deleting MongoDB documents for session: ${sessionId}`);
            await this.vectorStore.deleteDocuments({ sessionId });
            console.log(`[CLEANUP] MongoDB documents deleted`);
        }

        // 2. Delete local session directory
        const sessionDir = path.join(this.sessionsBaseDir, sessionId);
        console.log(`[CLEANUP] Checking session directory: ${sessionDir}`);
        if (fs.existsSync(sessionDir)) {
            console.log(`[CLEANUP] Deleting session directory: ${sessionDir}`);
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log(`[CLEANUP] Session directory deleted`);
        } else {
            console.log(`[CLEANUP] Session directory does not exist`);
        }

        console.log(`[CLEANUP] Cleanup completed for session: ${sessionId}`);
    }

    async ingestSampleData(sessionId: string): Promise<void> {
        const sampleDataDir = path.join(process.cwd(), "data", "top100");
        const sessionDir = this.ensureSessionDir(sessionId);

        if (!fs.existsSync(sampleDataDir)) {
            throw new Error("Sample data directory not found.");
        }

        const files = fs.readdirSync(sampleDataDir).filter(f => f.endsWith(".txt") || f.endsWith(".pdf"));
        for (const file of files) {
            const src = path.join(sampleDataDir, file);
            const dest = path.join(sessionDir, file);
            fs.copyFileSync(src, dest);
        }

        await this.ingestDirectory(sessionId);
    }
}
