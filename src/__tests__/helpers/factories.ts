/**
 * Reusable test factories for Quizlab test suite.
 *
 * Goal: reduce duplication, provide realistic and stable test data,
 * avoid hard-coded magic numbers in assertions, and make new test
 * files easy to write.
 *
 * Conventions:
 *  - All factories return fresh data on every call (no shared state)
 *  - All factories accept optional overrides as the last argument
 *  - All factories are pure functions, side-effect free
 *  - IDs are deterministic and unique per call (e.g. counter suffixes)
 */

import type { ApiChatMessage, ApiProviderConfig, PdfFile } from '@shared-core/types'

import type { LastReadingInfo, PdfTab } from '@features/pdf/hooks/types'

import { tmpdir } from 'os'
import { join } from 'path'

const testTempDir = tmpdir()
let idCounter = 0

/**
 * Reset the global factory counter. Useful for test isolation.
 */
export function resetFactoryCounters(): void {
  idCounter = 0
}

/**
 * Build a deterministic PDF file for tests.
 */
export function makePdfFile(overrides: Partial<PdfFile> = {}): PdfFile {
  const idx = ++idCounter
  return {
    name: overrides.name ?? `document-${idx}.pdf`,
    path: overrides.path ?? join(testTempDir, `document-${idx}.pdf`),
    streamUrl: overrides.streamUrl ?? `blob:stream-${idx}`,
    size: overrides.size ?? 1024 * idx
  }
}

/**
 * Build a list of PDF files.
 */
export function makePdfFiles(count: number, overrides: Partial<PdfFile> = {}): PdfFile[] {
  return Array.from({ length: count }, () => makePdfFile(overrides))
}

/**
 * Build an API chat message with sensible defaults.
 */
export function makeChatMessage(overrides: Partial<ApiChatMessage> = {}): ApiChatMessage {
  const idx = ++idCounter
  return {
    id: overrides.id ?? `msg-${idx}`,
    role: overrides.role ?? 'user',
    content: overrides.content ?? `Message ${idx}`,
    timestamp: overrides.timestamp ?? Date.now(),
    ...(overrides.providerId !== undefined ? { providerId: overrides.providerId } : {}),
    ...(overrides.images ? { images: overrides.images } : {})
  }
}

/**
 * Build a list of chat messages.
 */
export function makeChatMessages(
  count: number,
  overrides: Partial<ApiChatMessage> = {}
): ApiChatMessage[] {
  return Array.from({ length: count }, () => makeChatMessage(overrides))
}

/**
 * Build a conversation (alternating user / assistant).
 */
export function makeConversation(rounds: number): ApiChatMessage[] {
  const messages: ApiChatMessage[] = []
  for (let i = 0; i < rounds; i++) {
    messages.push(makeChatMessage({ role: 'user', content: `User question ${i + 1}` }))
    messages.push(makeChatMessage({ role: 'assistant', content: `Assistant reply ${i + 1}` }))
  }
  return messages
}

/**
 * Build a provider config for AI chat (OpenAI by default).
 */
export function makeProviderConfig(overrides: Partial<ApiProviderConfig> = {}): ApiProviderConfig {
  const idx = ++idCounter
  return {
    id: overrides.id ?? `provider-${idx}`,
    name: overrides.name ?? `Provider ${idx}`,
    baseUrl: overrides.baseUrl ?? 'https://api.example.com/v1',
    apiKey: overrides.apiKey ?? `sk-test-${idx}`,
    defaultModel: overrides.defaultModel ?? 'gpt-4o-mini',
    enabled: overrides.enabled ?? true,
    models: overrides.models ?? ['gpt-4o-mini', 'gpt-4o'],
    providerType: overrides.providerType ?? 'openai'
  }
}

/**
 * Build a list of provider configs with different vendor defaults.
 */
export function makeProviderList(): ApiProviderConfig[] {
  return [
    makeProviderConfig({
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      providerType: 'openai'
    }),
    makeProviderConfig({
      id: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      providerType: 'anthropic'
    }),
    makeProviderConfig({
      id: 'gemini',
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      providerType: 'google'
    })
  ]
}

/**
 * Build a LastReadingInfo entry for the recent-files history.
 */
export function makeLastReading(overrides: Partial<LastReadingInfo> = {}): LastReadingInfo {
  const idx = ++idCounter
  return {
    name: overrides.name ?? `history-${idx}.pdf`,
    path: overrides.path ?? join(testTempDir, `history-${idx}.pdf`),
    page: overrides.page ?? 1,
    totalPages: overrides.totalPages ?? 10,
    lastOpenedAt: overrides.lastOpenedAt ?? Date.now() - idx * 60_000
  }
}

/**
 * Build a list of last-reading history entries (newest first).
 */
export function makeLastReadingList(count: number): LastReadingInfo[] {
  return Array.from({ length: count }, (_, i) =>
    makeLastReading({
      name: `history-${i + 1}.pdf`,
      path: join(testTempDir, `history-${i + 1}.pdf`),
      lastOpenedAt: Date.now() - i * 60_000
    })
  )
}

/**
 * Build a PDF tab descriptor.
 */
export function makePdfTab(overrides: Partial<PdfTab> = {}): PdfTab {
  const idx = ++idCounter
  const file =
    overrides.file !== undefined ? overrides.file : makePdfFile({ name: `tab-${idx}.pdf` })
  return {
    id: overrides.id ?? `tab-${idx}`,
    file,
    kind: overrides.kind ?? 'pdf',
    ...(overrides.title !== undefined ? { title: overrides.title } : {}),
    ...(overrides.webviewUrl !== undefined ? { webviewUrl: overrides.webviewUrl } : {}),
    ...(overrides.viewerSessionKey !== undefined
      ? { viewerSessionKey: overrides.viewerSessionKey }
      : {})
  }
}

/**
 * Build a stable UTC timestamp N minutes in the past.
 */
export function minutesAgo(minutes: number): number {
  return Date.now() - minutes * 60_000
}

/**
 * Build a stable UTC timestamp N days in the past.
 */
export function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60_000
}

/**
 * Create an in-memory localStorage mock pre-seeded with the provided entries.
 * Returns a cleanup function. Useful when a test needs to start from a known
 * storage state but the test runs in a worker that already has localStorage.
 */
export function seedLocalStorage(entries: Record<string, string>): () => void {
  const previous: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(entries)) {
    previous[key] = localStorage.getItem(key)
    localStorage.setItem(key, value)
  }
  return () => {
    for (const [key] of Object.entries(entries)) {
      const prev = previous[key]
      if (prev === null) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, prev)
      }
    }
  }
}
