/**
 * PDF Capture Engine — centralizes screenshot/capture logic for PDF pages.
 * Handles canvas discovery, blob lifecycle, and memory-safe image capture.
 */

export { findPageCanvas } from './findPageCanvas'
export { captureCanvasAsBlob } from './captureCanvasAsBlob'
export type { CaptureOptions, CaptureResult } from './types'
