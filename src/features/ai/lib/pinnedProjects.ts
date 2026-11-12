import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { getStorageItem, writeStorageItem } from '@shared/hooks/localStorageUtils'

export const PINNED_AI_PROJECT_LIMIT = 50

export interface PinnedAiProject {
  /** Stable identity: one pin per AI site + URL pair. */
  id: string
  modelId: string
  /** Name the user chose for the pin. */
  name: string
  /** URL the pin opens. */
  url: string
  /** Epoch milliseconds of the first save. */
  createdAt: number
}

const MAX_NAME_LENGTH = 80

function normalizeName(rawName: string): string | null {
  const name = rawName.replaceAll(/\s+/g, ' ').trim()
  if (!name) return null
  return name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH - 1) + '…' : name
}

function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function createPinnedAiProject(
  modelId: string,
  rawName: string,
  rawUrl: string,
  createdAt: number = Date.now()
): PinnedAiProject | null {
  if (!modelId) return null
  const name = normalizeName(rawName)
  const url = normalizeUrl(rawUrl)
  if (!name || !url) return null
  return {
    id: `${modelId}::${url}`,
    modelId,
    name,
    url,
    createdAt
  }
}

export function sanitizePinnedAiProjects(value: unknown): PinnedAiProject[] {
  if (!Array.isArray(value)) return []

  const byId = new Map<string, PinnedAiProject>()
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue
    const row = candidate as Partial<PinnedAiProject>
    if (typeof row.modelId !== 'string' || typeof row.name !== 'string') continue
    if (typeof row.url !== 'string') continue
    const createdAt =
      typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
        ? row.createdAt
        : Date.now()
    const project = createPinnedAiProject(row.modelId, row.name, row.url, createdAt)
    if (!project) continue
    const existing = byId.get(project.id)
    if (!existing || existing.createdAt < project.createdAt) {
      byId.set(project.id, project)
    }
  }

  return [...byId.values()]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, PINNED_AI_PROJECT_LIMIT)
}

export function readPinnedAiProjects(): PinnedAiProject[] {
  const raw = getStorageItem(STORAGE_KEYS.PINNED_AI_PROJECTS)
  if (!raw) return []
  try {
    return sanitizePinnedAiProjects(JSON.parse(raw))
  } catch {
    return []
  }
}

function writePinnedAiProjects(projects: PinnedAiProject[]): void {
  writeStorageItem(STORAGE_KEYS.PINNED_AI_PROJECTS, JSON.stringify(projects))
}

/**
 * Saves a new pin. Re-pinning the same URL updates its name instead of adding a
 * duplicate, while keeping its original position and creation time.
 */
export function savePinnedAiProject(project: PinnedAiProject): void {
  const current = readPinnedAiProjects()
  const exists = current.some((item) => item.id === project.id)
  const next = exists
    ? current.map((item) =>
        item.id === project.id
          ? { ...item, name: project.name, modelId: project.modelId, url: project.url }
          : item
      )
    : [project, ...current].slice(0, PINNED_AI_PROJECT_LIMIT)
  writePinnedAiProjects(next)
}

export function removePinnedAiProject(id: string): void {
  writePinnedAiProjects(readPinnedAiProjects().filter((project) => project.id !== id))
}
