export type WebviewInputEvent = {
    type: 'keyDown' | 'keyUp' | 'char';
    keyCode: string;
    modifiers?: string[];
}

export type WebviewElement = HTMLElement & {
    executeJavaScript: (script: string) => Promise<unknown>;
    reload: () => void;
    loadURL?: (url: string) => void;
    goBack?: () => void;
    goForward?: () => void;
    getURL?: () => string;
    sendInputEvent?: (event: WebviewInputEvent) => void;
    paste?: () => void;
    getWebContentsId?: () => number | undefined;
    addEventListener: (event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;
    removeEventListener: (event: string, handler: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => void;
    isDestroyed?: () => boolean;
    focus?: () => void;
    insertText?: (text: string) => void;
}

export type WebviewController = {
    executeJavaScript: (script: string) => Promise<unknown> | undefined;
    getActiveWebview?: () => WebviewElement | null;
    getWebview?: () => WebviewElement | null;
    insertText?: (text: string) => void;
    reload?: () => void;
    goBack?: () => void;
    goForward?: () => void;
    getURL?: () => string | undefined;
    sendInputEvent?: (event: WebviewInputEvent) => void;
    paste?: () => void;
    getWebContentsId?: () => number | undefined;
    pasteNative?: (id: number) => Promise<boolean> | boolean;
    addEventListener?: (event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;
    removeEventListener?: (event: string, handler: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => void;
    focus?: () => void;
    isDestroyed?: () => boolean;
}
