/**
 * Tests for shared/types and shared/constants. These modules are the
 * type contract between the renderer and the main process. A renamed or
 * removed constant will silently break IPC, so we pin them down here.
 */
import {
  DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
  GOOGLE_AI_WEB_APPS,
  GOOGLE_DRIVE_WEB_APP,
  GOOGLE_WEB_SESSION_APPS,
  GOOGLE_WEB_SESSION_REGISTRY_IDS,
  PRIMARY_GOOGLE_AI_WEB_APP
} from '@shared-core/constants/google-ai-web-apps'
import { IPC_CHANNELS } from '@shared-core/constants/ipc-channels'

import { describe, expect, it } from 'vitest'

describe('IPC_CHANNELS - structural invariants', () => {
  it('is a non-null object', () => {
    expect(typeof IPC_CHANNELS).toBe('object')
  })

  it('has at least 30 channels defined', () => {
    const channelCount = Object.keys(IPC_CHANNELS).length
    expect(channelCount).toBeGreaterThanOrEqual(30)
  })

  it('every channel value is a non-empty string', () => {
    for (const [k, v] of Object.entries(IPC_CHANNELS)) {
      expect(typeof v, `IPC_CHANNELS.${k} should be a string`).toBe('string')
      expect(v.length, `IPC_CHANNELS.${k} should not be empty`).toBeGreaterThan(0)
    }
  })

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

  it('property keys are SCREAMING_SNAKE_CASE', () => {
    for (const k of Object.keys(IPC_CHANNELS)) {
      expect(k).toMatch(/^[A-Z][\dA-Z_]*$/)
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
    'OPEN_RELEASES',
    'GET_APP_VERSION',
    'FORCE_PASTE',
    'SAVE_AI_CONFIG',
    'GET_AI_CONFIG',
    'DELETE_AI_CONFIG',
    'GET_AI_REGISTRY',
    'GET_AUTOMATION_SCRIPTS',
    'ADD_CUSTOM_AI',
    'DELETE_CUSTOM_AI',
    'IS_AUTH_DOMAIN',
    'CLEAR_CACHE',
    'APP_QUIT',
    'GET_API_CHAT_CONFIG',
    'SAVE_API_CHAT_CONFIG',
    'SEND_API_CHAT_REQUEST',
    'FETCH_API_CHAT_MODELS'
  ]

  for (const channel of required) {
    it(`defines ${channel}`, () => {
      expect(IPC_CHANNELS).toHaveProperty(channel)
      expect(typeof (IPC_CHANNELS as any)[channel]).toBe('string')
    })
  }
})

describe('GOOGLE_WEB_SESSION_APPS - registry invariants', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GOOGLE_WEB_SESSION_APPS)).toBe(true)
    expect(GOOGLE_WEB_SESSION_APPS.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty id from the GoogleWebSessionAppId union', () => {
    const validIds = new Set(['gemini', 'aistudio', 'youtube', 'gdrive'])
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(typeof app.id).toBe('string')
      expect(validIds.has(app.id)).toBe(true)
    }
  })

  it('ids are unique', () => {
    const ids = GOOGLE_WEB_SESSION_APPS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry has a non-empty name', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(typeof app.name).toBe('string')
      expect(app.name.length).toBeGreaterThan(0)
    }
  })

  it('every URL starts with http:// or https://', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(app.url).toMatch(/^https?:\/\//)
    }
  })

  it('every hostname is non-empty', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(typeof app.hostname).toBe('string')
      expect(app.hostname.length).toBeGreaterThan(0)
    }
  })

  it('every color is a valid hex', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(app.color).toMatch(/^#[\dA-Fa-f]{3,6}$/)
    }
  })

  it('every surface is one of ai/site/pdf', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(['ai', 'site', 'pdf']).toContain(app.surface)
    }
  })

  it('every registryEligible and healthCheckEligible is a boolean', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(typeof app.registryEligible).toBe('boolean')
      expect(typeof app.healthCheckEligible).toBe('boolean')
    }
  })

  it('healthPathPrefixes is always an array', () => {
    for (const app of GOOGLE_WEB_SESSION_APPS) {
      expect(Array.isArray(app.healthPathPrefixes)).toBe(true)
    }
  })
})

describe('GOOGLE_AI_WEB_APPS - filtered subset', () => {
  it('contains only apps that are healthCheckEligible', () => {
    for (const app of GOOGLE_AI_WEB_APPS) {
      expect(app.healthCheckEligible).toBe(true)
    }
  })

  it('is a subset of GOOGLE_WEB_SESSION_APPS', () => {
    const fullIds = new Set(GOOGLE_WEB_SESSION_APPS.map((a) => a.id))
    for (const app of GOOGLE_AI_WEB_APPS) {
      expect(fullIds.has(app.id)).toBe(true)
    }
  })

  it('PRIMARY_GOOGLE_AI_WEB_APP is the first entry', () => {
    expect(PRIMARY_GOOGLE_AI_WEB_APP).toBe(GOOGLE_AI_WEB_APPS[0])
  })
})

describe('GOOGLE_WEB_SESSION_REGISTRY_IDS', () => {
  it('contains only registryEligible app ids', () => {
    const registryApps = GOOGLE_WEB_SESSION_APPS.filter((a) => a.registryEligible)
    const expected = registryApps.map((a) => a.id)
    expect([...GOOGLE_WEB_SESSION_REGISTRY_IDS].sort()).toEqual([...expected].sort())
  })

  it('does not include registry-ineligible apps (e.g. gdrive)', () => {
    expect(GOOGLE_WEB_SESSION_REGISTRY_IDS).not.toContain('gdrive')
  })
})

describe('DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS', () => {
  it('includes all web session app ids by default', () => {
    const allIds = GOOGLE_WEB_SESSION_APPS.map((a) => a.id).sort()
    expect([...DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS].sort()).toEqual(allIds)
  })
})

describe('GOOGLE_DRIVE_WEB_APP', () => {
  it('has a non-empty id and url', () => {
    expect(typeof GOOGLE_DRIVE_WEB_APP.id).toBe('string')
    expect(GOOGLE_DRIVE_WEB_APP.id.length).toBeGreaterThan(0)
    expect(typeof GOOGLE_DRIVE_WEB_APP.url).toBe('string')
    expect(GOOGLE_DRIVE_WEB_APP.url).toMatch(/^https?:\/\//)
  })
})
