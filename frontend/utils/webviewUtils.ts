import { Logger } from './logger';
import type { WebviewController, WebviewInputEvent } from '../types/webview';

/**
 * Safely performs a paste operation on the given webview.
 * Uses native paste() if available, falls back to input simulation.
 * 
 * @param webview - The webview element to paste into
 * @returns {boolean} - True if the operation was attempted successfully
 */
export const safeWebviewPaste = (webview: WebviewController | null): boolean => { // Electron.WebviewTag replacement
    if (!webview) {
        Logger.error('[WebviewUtils] Webview is undefined');
        return false;
    }

    // Modern webview method (Safe & Platform Independent)
    if (typeof webview.paste === 'function') {
        try {
            webview.paste();
            return true;
        } catch (error) {
            Logger.error('[WebviewUtils] Native paste failed:', error);
            // Fallthrough to fallback mechanism if native fails? 
            // Usually if paste() fails throws, input simulation might also fail, but worth a try or just return false.
            // Let's return false to avoid unpredictable behavior.
            return false;
        }
    }

    // Legacy / Fallback Mechanism
    Logger.warn('[WebviewUtils] webview.paste() not found, attempting input simulation.');

    try {
        const modifier = (window.electronAPI?.platform === 'darwin') ? 'meta' : 'control';

        // Ensure webview reference has the method
        if (typeof webview.sendInputEvent === 'function') {
            // Simulate Ctrl+V / Cmd+V
            const inputDef: Omit<WebviewInputEvent, 'type'> = {
                keyCode: 'v',
                modifiers: [modifier.toLowerCase() as string] // Ensure lowercase, string replacement for Electron.InputEventModifier
            };

            webview.sendInputEvent({ type: 'keyDown', ...inputDef });
            webview.sendInputEvent({ type: 'char', ...inputDef });
            webview.sendInputEvent({ type: 'keyUp', ...inputDef });
            return true;
        } else {
            Logger.error('[WebviewUtils] sendInputEvent API missing');
            return false;
        }
    } catch (error) {
        Logger.error('[WebviewUtils] Input simulation failed:', error);
        return false;
    }
};
