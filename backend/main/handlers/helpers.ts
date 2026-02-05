import { app } from 'electron'
import path from 'path'

export const getCustomPlatformsPath = () => path.join(app.getPath('userData'), 'ai_custom_platforms.json')
export const getAiConfigPath = () => path.join(app.getPath('userData'), 'ai_custom_selectors.json')
export const getQuizSettingsPath = () => path.join(app.getPath('userData'), 'quiz_settings.json')
