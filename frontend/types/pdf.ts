export type PdfFile = {
    path?: string | null;
    name?: string;
    streamUrl?: string | null;
    size?: number | null;
    type?: 'file' | 'folder' | string;
    id?: string;
    parentId?: string | null;
}
