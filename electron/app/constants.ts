/**
 * Shared constants for the Main Process
 * IPC_CHANNELS are imported from shared/constants for single source of truth
 */
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'

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
    IPC_CHANNELS,
    SCREENSHOT_TYPES: {
        FULL: 'full-page',
        CROP: 'crop'
    }
}

