/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

interface ImportMetaEnv {
    readonly MODE: string;
    readonly BASE_URL: string;
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly SSR: boolean;
    readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}


// Image module declarations
// Keep this file as declaration-only (no runtime behavior).
declare module '*.png' {
    const src: string;
    export default src;
}

declare module '*.svg' {
    const src: string;
    export default src;
}

declare module '*.jpg' {
    const src: string;
    export default src;
}

declare module '*.jpeg' {
    const src: string;
    export default src;
}

declare module '*.gif' {
    const src: string;
    export default src;
}

declare module '*.webp' {
    const src: string;
    export default src;
}

// PDF.js worker URL import
declare module 'pdfjs-dist/build/pdf.worker.min.js?url' {
    const url: string;
    export default url;
}

declare module '*?url' {
    const src: string;
    export default src;
}
