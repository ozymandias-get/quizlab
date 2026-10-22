import { beforeEach, describe, expect, it } from 'vitest'

import {
  APP_SESSION_PARTITION,
  evaluateWebPermission,
  isAllowedManagedViewPartition,
  isCustomPartition,
  isHostTrustedForPartition,
  listManagedAiPartitions,
  recordConsentDecision,
  registerAccountPartition,
  registerCustomPlatformOrigin,
  resetConsentDecisions,
  resetCustomPlatformOrigins,
  unregisterAccountPartition,
  unregisterCustomPlatformOrigin
} from '../../../app/window/permissionPolicy.js'

const CHATGPT = 'persist:ai_chatgpt'
const CUSTOM = 'persist:ai_custom_abc'

const ask = (over: Partial<Parameters<typeof evaluateWebPermission>[0]> = {}) =>
  evaluateWebPermission({
    partition: CHATGPT,
    permission: 'media',
    requestingUrl: 'https://chatgpt.com/',
    isMainFrame: true,
    ...over
  })

describe('window/permissionPolicy', () => {
  beforeEach(() => {
    resetConsentDecisions()
    resetCustomPlatformOrigins()
  })

  describe('partition binding', () => {
    it.each([
      ['an unknown partition', 'persist:attacker'],
      ['a custom partition with no registered origin', CUSTOM],
      ['the generic ai_session partition', 'persist:ai_session']
    ])('grants nothing on %s', (_label, partition) => {
      const d = ask({ partition, permission: 'media' })
      expect(d.granted).toBe(false)
      expect(d.requiresConsent).toBe(false)
    })

    it('recognises custom partitions by prefix', () => {
      expect(isCustomPartition(CUSTOM)).toBe(true)
      expect(isCustomPartition(CHATGPT)).toBe(false)
      expect(isCustomPartition('persist:ai_custom_')).toBe(true)
    })
  })

  describe('origin validation', () => {
    it('denies when requestingUrl is missing', () => {
      const d = evaluateWebPermission({
        partition: CHATGPT,
        permission: 'notifications',
        isMainFrame: true
      })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('malformed_origin')
    })

    it.each([
      'not a url',
      'chatgpt.com',
      'https://',
      '//chatgpt.com',
      'javascript:alert(1)',
      'https://chatgpt.com:notaport'
    ])('denies malformed requestingUrl %s', (requestingUrl) => {
      const d = ask({ permission: 'notifications', requestingUrl })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('malformed_origin')
    })

    it('rejects non-https requestingUrl', () => {
      const d = ask({ permission: 'notifications', requestingUrl: 'http://chatgpt.com/' })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('malformed_origin')
    })

    it('falls back to requestingOrigin when requestingUrl is absent', () => {
      const d = ask({
        permission: 'notifications',
        requestingUrl: undefined,
        requestingOrigin: 'https://chatgpt.com'
      })
      expect(d.granted).toBe(true)
    })

    it('accepts a subdomain of the registered host', () => {
      const d = ask({ permission: 'notifications', requestingUrl: 'https://api.chatgpt.com/' })
      expect(d.granted).toBe(true)
    })
  })

  describe('origin spoofing and redirect', () => {
    it.each([
      'https://evil.com/',
      'https://chatgpt.com.evil.com/',
      'https://chatgpt.com.evil.io/',
      'https://notchatgpt.com/',
      'https://evilchatgpt.com/',
      'https://chatgpt.computer/',
      // Auth domains the app blocks from guest navigation must not inherit
      // the provider's grant.
      'https://auth.openai.com/',
      'https://accounts.google.com/'
    ])('denies %s on the chatgpt partition', (requestingUrl) => {
      const d = ask({ permission: 'media', requestingUrl })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('origin_not_registered')
    })

    it('keeps a cross-partition origin out', () => {
      // claude.ai has no ambient allowlist, and the chatgpt partition must not
      // be usable to reach it.
      const d = ask({
        partition: 'persist:ai_claude',
        permission: 'media',
        requestingUrl: 'https://claude.ai/'
      })
      expect(d.granted).toBe(false)
      expect(d.requiresConsent).toBe(true)
    })
  })

  describe('subframes', () => {
    it.each(['media', 'geolocation'])('denies ambient %s to a subframe', (permission) => {
      const d = ask({ permission, isMainFrame: false })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('subframe_denied')
    })

    it('still allows passive permissions in subframes', () => {
      const d = ask({ permission: 'notifications', isMainFrame: false })
      expect(d.granted).toBe(true)
    })
  })

  describe('passive permissions', () => {
    it.each(['notifications', 'fullscreen', 'pointerLock', 'clipboard-sanitized-write'])(
      'allows %s on a trusted origin without consent',
      (permission) => {
        const d = ask({ permission })
        expect(d.granted).toBe(true)
        expect(d.requiresConsent).toBe(false)
      }
    )

    it.each(['clipboard-read', 'openExternal', 'midi', 'hid', 'serial', 'unknown-permission'])(
      'denies unlisted permission %s even on a trusted origin',
      (permission) => {
        const d = ask({ permission })
        expect(d.granted).toBe(false)
        expect(d.reason).toBe('permission_not_allowlisted')
      }
    )
  })

  describe('geolocation', () => {
    it.each([
      ['persist:ai_chatgpt', 'https://chatgpt.com/'],
      ['persist:ai_claude', 'https://claude.ai/'],
      ['persist:ai_m365', 'https://m365.cloud.microsoft/'],
      ['persist:gemini_web_profile', 'https://gemini.google.com/']
    ])('denies geolocation on %s because no provider needs it', (partition, requestingUrl) => {
      const d = ask({ partition, permission: 'geolocation', requestingUrl })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('ambient_not_supported_by_provider')
      expect(d.requiresConsent).toBe(false)
    })

    it('denies geolocation for a provider without an ambient allowlist at all', () => {
      const d = ask({
        partition: 'persist:ai_perplexity',
        permission: 'geolocation',
        requestingUrl: 'https://perplexity.ai/'
      })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('ambient_not_supported_by_provider')
    })
  })

  describe('custom platforms are default-deny for ambient permissions', () => {
    beforeEach(() => {
      registerCustomPlatformOrigin(CUSTOM, 'https://my-llm.example.com/chat')
    })

    it.each(['media', 'geolocation', 'display-capture'])(
      'denies %s for a custom platform even with a registered origin',
      (permission) => {
        const d = ask({
          partition: CUSTOM,
          permission,
          requestingUrl: 'https://my-llm.example.com/chat'
        })
        expect(d.granted).toBe(false)
        expect(d.reason).toBe('ambient_not_supported_by_provider')
      }
    )

    it('allows passive permissions for the registered origin', () => {
      const d = ask({
        partition: CUSTOM,
        permission: 'notifications',
        requestingUrl: 'https://my-llm.example.com/chat'
      })
      expect(d.granted).toBe(true)
    })

    it('denies a different origin sharing the custom partition', () => {
      const d = ask({
        partition: CUSTOM,
        permission: 'notifications',
        requestingUrl: 'https://attacker.example.net/'
      })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('origin_not_registered')
    })

    it('stops trusting the origin after unregistering the platform', () => {
      unregisterCustomPlatformOrigin(CUSTOM)
      const d = ask({
        partition: CUSTOM,
        permission: 'notifications',
        requestingUrl: 'https://my-llm.example.com/chat'
      })
      expect(d.granted).toBe(false)
    })

    it('ignores a non-https custom url', () => {
      registerCustomPlatformOrigin('persist:ai_custom_bad', 'http://insecure.example.com/')
      const d = ask({
        partition: 'persist:ai_custom_bad',
        permission: 'notifications',
        requestingUrl: 'http://insecure.example.com/'
      })
      expect(d.granted).toBe(false)
    })
  })

  describe('consent gating', () => {
    it('requires consent before granting media on a supported provider', () => {
      const d = ask({ permission: 'media' })
      expect(d.granted).toBe(false)
      expect(d.requiresConsent).toBe(true)
      expect(d.reason).toBe('consent_required')
    })

    it('grants media once consent is recorded', () => {
      recordConsentDecision(CHATGPT, 'chatgpt.com', 'media', true)
      const d = ask({ permission: 'media' })
      expect(d.granted).toBe(true)
      expect(d.requiresConsent).toBe(false)
    })

    it('denies without re-prompting after a recorded denial', () => {
      recordConsentDecision(CHATGPT, 'chatgpt.com', 'media', false)
      const d = ask({ permission: 'media' })
      expect(d.granted).toBe(false)
      expect(d.requiresConsent).toBe(false)
      expect(d.reason).toBe('consent_denied')
    })

    it('scopes consent to the origin that gave it', () => {
      recordConsentDecision(CHATGPT, 'chatgpt.com', 'media', true)
      const d = ask({ permission: 'media', requestingUrl: 'https://api.chatgpt.com/' })
      expect(d.granted).toBe(false)
      expect(d.requiresConsent).toBe(true)
    })

    it('scopes consent to the permission that was granted', () => {
      recordConsentDecision(CHATGPT, 'chatgpt.com', 'media', true)
      expect(ask({ permission: 'geolocation' }).granted).toBe(false)
    })

    it('does not require consent for display-capture, which the picker gates', () => {
      const d = ask({ permission: 'display-capture' })
      expect(d.granted).toBe(true)
      expect(d.requiresConsent).toBe(false)
    })
  })

  describe('providers without ambient support', () => {
    it.each([
      ['persist:ai_deepseek', 'https://chat.deepseek.com/'],
      ['persist:ai_qwen', 'https://chat.qwenlm.ai/'],
      ['persist:ai_kimi', 'https://kimi.com/'],
      ['persist:ai_perplexity', 'https://perplexity.ai/'],
      ['persist:ai_mistral', 'https://chat.mistral.ai/'],
      ['persist:ai_manus', 'https://manus.im/'],
      ['persist:ai_grok', 'https://grok.com/'],
      ['persist:ai_huggingchat', 'https://huggingface.co/chat']
    ])('denies media on %s', (partition, requestingUrl) => {
      const d = ask({ partition, permission: 'media', requestingUrl })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('ambient_not_supported_by_provider')
    })

    it('allows passive permissions on inactive providers', () => {
      const d = ask({
        partition: 'persist:ai_perplexity',
        permission: 'notifications',
        requestingUrl: 'https://perplexity.ai/'
      })
      expect(d.granted).toBe(true)
    })
  })

  describe('google session partition', () => {
    it.each([
      'https://gemini.google.com/app',
      'https://aistudio.google.com/welcome',
      'https://www.youtube.com/',
      'https://drive.google.com/drive/my-drive'
    ])('binds %s to the gemini partition', (requestingUrl) => {
      const d = ask({
        partition: 'persist:gemini_web_profile',
        permission: 'notifications',
        requestingUrl
      })
      expect(d.granted).toBe(true)
    })

    it('denies an unrelated host on the gemini partition', () => {
      const d = ask({
        partition: 'persist:gemini_web_profile',
        permission: 'notifications',
        requestingUrl: 'https://evil.com/'
      })
      expect(d.granted).toBe(false)
    })
  })

  describe('app session', () => {
    it.each(['file:///C:/app/dist/index.html', 'http://localhost:5173/', 'http://127.0.0.1:5173/'])(
      'allows media for the app document %s',
      (requestingUrl) => {
        const d = ask({
          partition: APP_SESSION_PARTITION,
          permission: 'media',
          requestingUrl
        })
        expect(d.granted).toBe(true)
        expect(d.reason).toBe('allowed_app_session')
      }
    )

    it('denies a remote page that reaches the default session', () => {
      const d = ask({
        partition: APP_SESSION_PARTITION,
        permission: 'media',
        requestingUrl: 'https://evil.com/'
      })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('origin_not_registered')
    })

    it('denies unlisted permissions even for the app document', () => {
      const d = ask({
        partition: APP_SESSION_PARTITION,
        permission: 'geolocation',
        requestingUrl: 'file:///C:/app/dist/index.html'
      })
      expect(d.granted).toBe(false)
    })
  })

  describe('account partitions', () => {
    beforeEach(() => {
      unregisterAccountPartition('persist:ai_chatgpt_a1')
    })

    // The panel must open the active account's partition: a partition minted
    // for an additional account is refused until it has been registered with
    // the policy at start-up.
    it('accepts a registered account partition and trusts its host', () => {
      registerAccountPartition('persist:ai_google_a1', 'https://gemini.google.com')
      expect(isAllowedManagedViewPartition('persist:ai_google_a1')).toBe(true)
      expect(isHostTrustedForPartition('persist:ai_google_a1', 'gemini.google.com')).toBe(true)
      unregisterAccountPartition('persist:ai_google_a1')
      expect(isAllowedManagedViewPartition('persist:ai_google_a1')).toBe(false)
    })

    it('keeps a subdomain of the registered host trusted', () => {
      registerAccountPartition('persist:ai_chatgpt_a1', 'https://chatgpt.com')
      try {
        expect(isHostTrustedForPartition('persist:ai_chatgpt_a1', 'auth.chatgpt.com')).toBe(true)
      } finally {
        unregisterAccountPartition('persist:ai_chatgpt_a1')
      }
    })

    it('denies ambient permissions for a registered account partition', () => {
      registerAccountPartition('persist:ai_chatgpt_a1', 'https://chatgpt.com')
      try {
        const d = ask({
          partition: 'persist:ai_chatgpt_a1',
          permission: 'media',
          requestingUrl: 'https://chatgpt.com/'
        })
        expect(d.granted).toBe(false)
        expect(d.requiresConsent).toBe(false)
        expect(d.reason).toBe('ambient_not_supported_by_provider')
      } finally {
        unregisterAccountPartition('persist:ai_chatgpt_a1')
      }
    })

    it('allows passive permissions for a registered account partition', () => {
      registerAccountPartition('persist:ai_chatgpt_a1', 'https://chatgpt.com')
      try {
        const d = ask({
          partition: 'persist:ai_chatgpt_a1',
          permission: 'notifications',
          requestingUrl: 'https://chatgpt.com/'
        })
        expect(d.granted).toBe(true)
        expect(d.requiresConsent).toBe(false)
      } finally {
        unregisterAccountPartition('persist:ai_chatgpt_a1')
      }
    })

    it('lists registered account partitions so their sessions get configured', () => {
      expect(listManagedAiPartitions()).not.toContain('persist:ai_chatgpt_a1')
      registerAccountPartition('persist:ai_chatgpt_a1', 'https://chatgpt.com')
      try {
        expect(listManagedAiPartitions()).toContain('persist:ai_chatgpt_a1')
      } finally {
        unregisterAccountPartition('persist:ai_chatgpt_a1')
      }
      expect(listManagedAiPartitions()).not.toContain('persist:ai_chatgpt_a1')
    })

    it('denies everything once the account is gone from the policy', () => {
      registerAccountPartition('persist:ai_chatgpt_a1', 'https://chatgpt.com')
      unregisterAccountPartition('persist:ai_chatgpt_a1')
      const d = ask({
        partition: 'persist:ai_chatgpt_a1',
        permission: 'notifications',
        requestingUrl: 'https://chatgpt.com/'
      })
      expect(d.granted).toBe(false)
      expect(d.reason).toBe('not_a_known_partition')
    })
  })

  describe('managed view partition allowlist', () => {
    // One representative per allowlist family: a plain provider, the shared
    // Google session and the custom prefix. The removed variant asserted 14
    // hardcoded partition names all returned `true`, which only restated the
    // production list back to itself.
    it.each([
      ['a built-in provider', 'persist:ai_chatgpt'],
      ['the shared session', 'persist:ai_session'],
      ['the Google web profile', 'persist:gemini_web_profile'],
      ['a custom platform', 'persist:ai_custom_abc']
    ])('allows %s partition', (_label, partition) => {
      expect(isAllowedManagedViewPartition(partition)).toBe(true)
    })

    it.each([undefined, null, '', 42, {}, 'persist:pdf_viewer', 'ai_chatgpt', 'persist:'])(
      'rejects %s',
      (partition) => {
        expect(isAllowedManagedViewPartition(partition)).toBe(false)
      }
    )
  })
})
