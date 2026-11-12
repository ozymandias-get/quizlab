/**
 * Tests for shared/types and shared/constants. These modules are the
 * type contract between the renderer and the main process. A renamed or
 * removed constant will silently break IPC, so we pin them down here.
 */
import {
  GOOGLE_WEB_SESSION_APPS,
  GOOGLE_WEB_SESSION_REGISTRY_IDS
} from '@shared-core/constants/googleAiWebApps'
import { IPC_CHANNELS } from '@shared-core/constants/ipcChannels'

import { describe, expect, it } from 'vitest'

describe('IPC_CHANNELS - structural invariants', () => {
  it('all channel values are unique', () => {
    const vals = Object.values(IPC_CHANNELS)
    expect(new Set(vals).size).toBe(vals.length)
  })

  it('all channel values use kebab-case', () => {
    for (const v of Object.values(IPC_CHANNELS)) {
      // Allow colon-separated segments (e.g. 'pdf:register-path')
      expect(v).toMatch(/^[a-z][\da-z-]*(:[a-z][\da-z-]*)*$/)
    }
  })
})

describe('IPC_CHANNELS - required channels present', () => {
  const required = [
    'SELECT_PDF',
    'GET_PDF_STREAM_URL',
    'PDF_REGISTER_PATH',
    'CAPTURE_SCREEN',
    'COPY_IMAGE',
    'COPY_TEXT',
    'OPEN_EXTERNAL',
    'CHECK_FOR_UPDATES',
    'GET_APP_VERSION',
    'AI_VIEW_ATTACH',
    'AI_VIEW_DETACH',
    'AI_VIEW_DESTROY',
    'AI_VIEW_RELOAD',
    'AI_VIEW_LOAD_URL',
    'AI_VIEW_NAVIGATE',
    'AI_VIEW_GET_URL',
    'AI_VIEW_EXECUTE_SCRIPT',
    'AI_VIEW_INSERT_TEXT',
    'AI_VIEW_SEND_INPUT_EVENT',
    'AI_VIEW_PASTE',
    'AI_VIEW_FOCUS',
    'AI_VIEW_SYNC_HOST',

    'AI_VIEW_EVENT',
    'SAVE_AI_CONFIG',
    'GET_AI_CONFIG',
    'DELETE_AI_CONFIG',
    'GET_AI_REGISTRY',
    'GET_AUTOMATION_SCRIPTS',
    'ADD_CUSTOM_AI',
    'DELETE_CUSTOM_AI',
    'CLEAR_CACHE',
    'APP_QUIT',
    'GET_API_CHAT_CONFIG',
    'SAVE_API_CHAT_CONFIG',
    'SEND_API_CHAT_REQUEST',
    'FETCH_API_CHAT_MODELS'
  ]

  it('defines every channel the renderer and the main process share', () => {
    for (const channel of required) {
      expect(IPC_CHANNELS, `IPC_CHANNELS.${channel} should be defined`).toHaveProperty(channel)
      expect(typeof (IPC_CHANNELS as any)[channel], `IPC_CHANNELS.${channel}`).toBe('string')
    }
  })
})

describe('GOOGLE_WEB_SESSION_APPS - registry invariants', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GOOGLE_WEB_SESSION_APPS)).toBe(true)
    expect(GOOGLE_WEB_SESSION_APPS.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty id from the GoogleWebSessionAppId union', () => {
    const validIds = new Set(['gemini', 'aistudio', 'youtube', 'gdrive', 'notebooklm'])
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(typeof app.id).toBe('string')
      expect(validIds.has(app.id)).toBe(true)
    }
  })

  it('ids are unique', () => {
    const ids = GOOGLE_WEB_SESSION_APPS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry has non-empty display metadata', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(typeof app.name).toBe('string')
      expect(app.name.length).toBeGreaterThan(0)
      expect(typeof app.hostname).toBe('string')
      expect(app.hostname.length).toBeGreaterThan(0)
    }
  })

  it('every URL starts with http:// or https://', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(app.url).toMatch(/^https?:\/\//)
    }
  })

  it('every color is a valid hex', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(app.color).toMatch(/^#[\dA-Fa-f]{3,6}$/)
    }
  })
})

describe('GOOGLE_WEB_SESSION_REGISTRY_IDS', () => {
  it('does not include registry-ineligible apps (e.g. gdrive)', () => {
    expect(GOOGLE_WEB_SESSION_REGISTRY_IDS).not.toContain('gdrive')
  })
})
