/**
 * Screenshot Feature — Public API
 *
 * ## Light entry point (this file)
 *
 * `useScreenshot` hook only. It is safe to import statically from any module.
 *
 * ## Heavy entry point (./tool)
 *
 * `ScreenshotTool` is heavy and depends on `@app/providers`, so it lives
 * behind its own chunk to keep this barrel cycle-free:
 * ```ts
 * const ScreenshotTool = lazy(() =>
 *   import('@features/screenshot/tool').then((m) => ({ default: m.ScreenshotTool }))
 * )
 * ```
 */
export { useScreenshot } from './hooks/useScreenshot'
