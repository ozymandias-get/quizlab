/**
 * Heavy lazy-load entry point for the Screenshot feature.
 *
 * `ScreenshotTool` pulls in `@app/providers` (toast actions), so exporting it
 * from the barrel would make the barrel heavy and create an import cycle with
 * `app/providers` for every light consumer of `useScreenshot`.
 *
 * Load it with:
 * ```ts
 * const ScreenshotTool = lazy(() =>
 *   import('@features/screenshot/tool').then((m) => ({ default: m.ScreenshotTool }))
 * )
 * ```
 */
export { default as ScreenshotTool } from './ui/ScreenshotTool'
