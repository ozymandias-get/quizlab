import { describe, expect, it } from 'vitest'

import { isAllowedManagedViewPartition } from '../../../app/window/permissionPolicy.js'
import {
  type CookiePacket,
  routeCookiePacket
} from '../../../features/web-session/siteSessionCookieRouter.js'
import {
  partitionForTargetSlot,
  type SiteSessionTargetRow
} from '../../../features/web-session/siteSessionTargets.js'

describe('siteSessionProfileSlot', () => {
  const MOCK_TARGET: SiteSessionTargetRow = {
    siteId: 'google',
    hostname: 'gemini.google.com',
    origins: ['https://gemini.google.com'],
    partition: 'persist:gemini_web_profile',
    cookieDomains: ['.google.com'],
    labelKey: 'ws_target_google',
    kind: 'google',
    memberAppIds: ['gemini']
  }

  describe('partitionForTargetSlot', () => {
    it('returns the base partition for slot 1 or undefined', () => {
      expect(partitionForTargetSlot('persist:gemini_web_profile')).toBe(
        'persist:gemini_web_profile'
      )
      expect(partitionForTargetSlot('persist:gemini_web_profile', 1)).toBe(
        'persist:gemini_web_profile'
      )
      expect(partitionForTargetSlot('persist:gemini_web_profile', 0)).toBe(
        'persist:gemini_web_profile'
      )
    })

    it('returns the slotted partition for slot 2 and above', () => {
      expect(partitionForTargetSlot('persist:gemini_web_profile', 2)).toBe(
        'persist:gemini_web_profile_slot_2'
      )
      expect(partitionForTargetSlot('persist:ai_chatgpt', 2)).toBe('persist:ai_chatgpt_slot_2')
    })
  })

  describe('routeCookiePacket with profileSlot', () => {
    it('preserves profileSlot in routed packet', () => {
      const packet: CookiePacket = {
        targetId: 'google',
        status: 'ok',
        cookies: [{ name: 'SID', value: '123', domain: '.google.com' }],
        profileSlot: 2
      }
      const routed = routeCookiePacket(packet, [MOCK_TARGET], () => true)
      expect(routed.ok).toBe(true)
      if (routed.ok) {
        expect(routed.profileSlot).toBe(2)
      }
    })

    it('defaults to profileSlot 1 when omitted', () => {
      const packet: CookiePacket = {
        targetId: 'google',
        status: 'ok',
        cookies: [{ name: 'SID', value: '123', domain: '.google.com' }]
      }
      const routed = routeCookiePacket(packet, [MOCK_TARGET], () => true)
      expect(routed.ok).toBe(true)
      if (routed.ok) {
        expect(routed.profileSlot).toBe(1)
      }
    })
  })

  describe('permissionPolicy for slotted partitions', () => {
    it('allows slot_2 partitions for known builtin targets', () => {
      expect(isAllowedManagedViewPartition('persist:gemini_web_profile_slot_2')).toBe(true)
      expect(isAllowedManagedViewPartition('persist:ai_chatgpt_slot_2')).toBe(false)
      expect(isAllowedManagedViewPartition('persist:gemini_web_profile_slot_3')).toBe(true)
      expect(isAllowedManagedViewPartition('persist:gemini_web_profile_slot_21')).toBe(false)
    })

    it('rejects slot_2 partitions for unknown base partitions', () => {
      expect(isAllowedManagedViewPartition('persist:unknown_base_slot_2')).toBe(false)
    })
  })
})
