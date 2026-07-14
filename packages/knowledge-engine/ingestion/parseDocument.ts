export interface ParsedDocument {

    id: string;

    title: string;

    content: string;

    pageCount: number;

    metadata: Record<string, string>;

}

export async function parseDocument() {

    throw new Error("Not implemented");

}