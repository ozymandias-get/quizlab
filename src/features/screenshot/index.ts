/**
 * 📐 Screenshot Feature — Public API
 *
 * ## Light entry point (this file)
 *
 * `useScreenshot` hook and `ScreenshotTool` component.
 * `ScreenshotTool` is heavy — use via `lazy(() => import('@features/screenshot'))`.
 */
export { useScreenshot } from './hooks/useScreenshot'
export { default as ScreenshotTool } from './ui/ScreenshotTool'
