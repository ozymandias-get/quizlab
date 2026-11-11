export const QUERY_KEYS = {
  AI: {
    /** API Chat provider config. */
    API_CHAT_CONFIG: ['api-chat', 'config'] as const,
    SESSIONS: ['ai', 'sessions'] as const,
    MESSAGES: (sessionId: string) => ['ai', 'messages', sessionId] as const
  }
} as const
