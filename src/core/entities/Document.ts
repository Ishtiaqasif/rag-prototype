export interface Document {
    pageContent: string;
    metadata: Record<string, any>;
    id?: string;
    vector?: number[];
}
