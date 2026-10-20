export const QUERY_KEYS = {
  AI: {
    REGISTRY: ['ai', 'registry'] as const,
    CONFIG: (hostname?: string) =>
      hostname ? (['ai', 'config', hostname] as const) : (['ai', 'config'] as const),
    SESSIONS: ['ai', 'sessions'] as const,
    MESSAGES: (sessionId: string) => ['ai', 'messages', sessionId] as const
  },
  PDF: {} as const,
  SYSTEM: {
    VERSION: ['system', 'version'] as const,
    UPDATE: ['system', 'update'] as const,
    CACHE_INFO: ['system', 'cache-info'] as const
  }
} as const
