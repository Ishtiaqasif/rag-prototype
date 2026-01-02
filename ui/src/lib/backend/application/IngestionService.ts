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

    constructor(vectorStore: IVectorStore) {
        this.vectorStore = vectorStore;
    }

    // ... (existing helper methods: extractEmail, extractName, etc. remain unchanged)

    async ingestSingleCV(fullContent: string, sourceName: string): Promise<void> {
        // ... (existing ingestSingleCV logic remains unchanged)
    }

    async ingestFile(filePath: string): Promise<void> {
        const file = path.basename(filePath);
        const loader = file.endsWith(".pdf") ? new PDFLoader(filePath) : new TextLoader(filePath);
        const docs = await loader.load();
        const fullContent = docs.map((d: any) => d.pageContent).join("\n");
        await this.ingestSingleCV(fullContent, file);
    }

    async ingestZip(zipPath: string): Promise<void> {
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        const tempDir = path.join(path.dirname(zipPath), `extracted_${path.basename(zipPath, ".zip")}`);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        try {
            zip.extractAllTo(tempDir, true);
            await this.ingestDirectoryRecursive(tempDir);
        } finally {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    }

    private async ingestDirectoryRecursive(dir: string): Promise<void> {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                await this.ingestDirectoryRecursive(fullPath);
            } else if (item.endsWith(".txt") || item.endsWith(".pdf")) {
                try {
                    await this.ingestFile(fullPath);
                } catch (err) {
                    console.error(`Error processing file ${item} in zip:`, err);
                }
            }
        }
    }

    async ingestDirectory(dataDir: string): Promise<void> {
        // ... (existing ingestDirectory remains unchanged)
    }
}
