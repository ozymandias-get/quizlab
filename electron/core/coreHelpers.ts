import { app } from 'electron'
import path from 'path'

export const getCustomPlatformsPath = () =>
  path.join(app.getPath('userData'), 'ai_custom_platforms.json')
export const getAiConfigPath = () => path.join(app.getPath('userData'), 'ai_custom_selectors.json')
export const getApiChatConfigPath = () => path.join(app.getPath('userData'), 'api_chat_config.json')
