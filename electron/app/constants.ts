/**
 * Shared constants for the Main Process
 * IPC_CHANNELS are imported from shared/constants for single source of truth
 */
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { SCREENSHOT_TYPES } from '../../shared/types/system'

export const APP_CONFIG = {
  PARTITIONS: {
    AI: 'persist:ai_session',
    PDF: 'persist:pdf_viewer'
  },
  GITHUB: {
    OWNER: 'ozymandias-get',
    REPO: 'quizlab'
  },
  CHROME_USER_AGENT: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome || '122.0.0.0'} Safari/537.36`,
  WINDOW: {
    MIN_WIDTH: 1000,
    MIN_HEIGHT: 600,
    DEFAULT_WIDTH: 1400,
    DEFAULT_HEIGHT: 900
  },
  CLEANUP: {
    STARTUP_DELAY_MS: 5000,
    IDLE_TIMEOUT_MS: 5 * 60 * 1000,
    MAX_TOTAL_CACHE_BYTES: 500 * 1024 * 1024,
    MAX_PARTITION_CACHE_BYTES: 100 * 1024 * 1024,
    TEMP_FILE_TTL_MS: 60 * 60 * 1000,
    CACHE_FILE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    BATCH_DELETE_SIZE: 10,
    BATCH_DELETE_SIZE_HEAVY: 500,
    SAFE_CACHE_DIRS: ['Cache', 'Code Cache', 'GPUCache'] as const,
    PARTITION_STORAGE_TYPES: [
      'cookies',
      'filesystem',
      'indexdb',
      'localstorage',
      'shadercache',
      'websql',
      'serviceworkers',
      'cachestorage'
    ] as const
  },
  IPC_CHANNELS,
  SCREENSHOT_TYPES
}
