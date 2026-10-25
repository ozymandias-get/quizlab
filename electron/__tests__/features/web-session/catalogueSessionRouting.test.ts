import { describe, expect, it, vi } from 'vitest'
import { AI_REGISTRY } from '../../../features/ai/aiManager.js'
import { routeCookiePacket } from '../../../features/web-session/siteSessionCookieRouter.js'
import { buildBuiltinSiteSessionTargets } from '../../../features/web-session/siteSessionTargets.js'

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: async () => ({})
}))

describe('catalogue Chrome session routing', () => {
  const targets = buildBuiltinSiteSessionTargets()

  it('routes every chat service to its own partition or the shared Google session', () => {
    const chats = Object.values(AI_REGISTRY).filter((p) => p.url && !p.isSite)
    expect(chats).toHaveLength(50)
    for (const platform of chats) {
      const target = targets.find((t) => t.memberAppIds.includes(platform.id))!
      const route = routeCookiePacket(
        {
          targetId: target.siteId,
          status: 'ok',
          cookies: [
            { name: 'session', value: 'test-only', domain: target.cookieDomains[0], path: '/' }
          ]
        },
        targets,
        () => true
      )
      expect(route.ok, platform.id).toBe(true)
      if (route.ok) expect(route.target.partition).toBe(platform.partition)
    }
  })

  it('rejects disabled targets and foreign domains across the entire catalogue', () => {
    for (const target of targets) {
      const packet = {
        targetId: target.siteId,
        status: 'ok' as const,
        cookies: [{ name: 'session', value: 'test-only', domain: target.cookieDomains[0] }]
      }
      expect(routeCookiePacket(packet, targets, () => false)).toEqual({
        ok: false,
        reason: 'target_disabled'
      })
      packet.cookies[0].domain = '.unrelated.example'
      expect(routeCookiePacket(packet, targets, () => true)).toEqual({
        ok: false,
        reason: 'domain_mismatch'
      })
    }
  })
})
