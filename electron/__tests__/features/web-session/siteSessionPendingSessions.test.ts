import { afterEach, describe, expect, it } from 'vitest'

import type { ChromeExtensionCookie } from '@shared-core/types'

import {
  clearPendingSiteSession,
  getPendingSiteSession,
  listPendingSiteSessionIds,
  setPendingSiteSession
} from '../../../features/web-session/siteSessionPendingSessions.js'

function cookie(name: string, value: string): ChromeExtensionCookie {
  return { name, value, domain: '.google.com' }
}

describe('pending site sessions', () => {
  afterEach(() => {
    for (const siteId of listPendingSiteSessionIds()) clearPendingSiteSession(siteId)
  })

  it('holds one pending session per site and forgets it when it is resolved', () => {
    setPendingSiteSession('google', [cookie('a', 'b')])
    expect(getPendingSiteSession('google')?.cookies).toHaveLength(1)
    expect(listPendingSiteSessionIds()).toEqual(['google'])
    clearPendingSiteSession('google')
    expect(getPendingSiteSession('google')).toBeNull()
  })

  it('replaces the pending session of a site with the newer one', () => {
    // A second session that cannot be attributed is the session the user has
    // to be asked about: the older one is no longer what Chrome holds.
    setPendingSiteSession('google', [cookie('a', 'b')])
    setPendingSiteSession('google', [cookie('c', 'd'), cookie('e', 'f')])

    expect(getPendingSiteSession('google')?.cookies.map((entry) => entry.name)).toEqual(['c', 'e'])
    expect(listPendingSiteSessionIds()).toEqual(['google'])
  })

  it('answers null for a site without a pending session', () => {
    expect(getPendingSiteSession('google')).toBeNull()
  })
})
