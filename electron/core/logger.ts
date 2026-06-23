/**
 * Electron main-process Logger shim.
 *
 * Re-exports from the shared logger so all code (renderer + main process)
 * uses the same implementation. Kept as a re-export wrapper to avoid
 * updating import paths across 38+ electron files in one go.
 *
 * See `src/shared/lib/logger.ts` for the full implementation.
 */

export {
  createIssueLogReport,
  flushToDisk,
  getRecentElectronLogs,
  initLogger,
  Logger,
  pushToLoggerBuffer,
  redactSensitive,
  reportSuppressedError
} from '../../src/shared/lib/logger'
