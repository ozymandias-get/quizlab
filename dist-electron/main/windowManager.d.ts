/**
 * Window Manager Module
 */
import { BrowserWindow } from 'electron';
export declare const isDev: boolean;
export declare function getMainWindow(): BrowserWindow | null;
export declare function createWindow(): BrowserWindow;
export declare function getSplashWindow(): BrowserWindow | null;
export declare function createSplashWindow(): BrowserWindow;
