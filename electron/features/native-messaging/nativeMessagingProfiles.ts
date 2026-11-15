import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from '../../core/logger.js'

/**
 * The Chrome profiles the app has seen.
 *
 * Chrome gives every profile its own extension storage, so a second profile is
 * a second, independent extension instance. The app remembers the names the
 * user gave those instances and which one was selected as the cookie source,
 * so the settings page can keep showing them across app restarts.
 *
 * The file only holds display data and the selection. The pairing secret is in
 * `bridge-secret.json` and is never written here.
 */
export interface PersistedExtensionProfile {
  id: string
  name: string
}

export interface PersistedExtensionProfiles {
  version: 1
  selectedProfileId: string | null
  /**
   * Advances whenever the selected profile changes.
   *
   * The extension compares it with the last value it saw, so a profile that
   * misses the transition (for example A -> B -> A between two polls) still
   * knows that its imported cookies may belong to another profile.
   */
  selectionVersion: number
  profiles: PersistedExtensionProfile[]
}

const FILE_NAME = 'bridge-profiles.json'
const PROFILE_ID_RE = /^[A-Za-z0-9_-]{8,80}$/

/** Whether a value can be a profile id the extension generated. */
export function isProfileId(value: unknown): value is string {
  return typeof value === 'string' && PROFILE_ID_RE.test(value.trim())
}

/** A name the user typed in the popup, cut to something a card can show. */
export function normalizeProfileName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replaceAll(/\s+/g, ' ').slice(0, 60)
}

/** The default state of a file that does not exist yet. */
function emptyState(): PersistedExtensionProfiles {
  return { version: 1, selectedProfileId: null, selectionVersion: 0, profiles: [] }
}

/**
 * Reads a file that may have been edited by hand.
 *
 * Duplicate ids collapse into one entry and names fall back to a readable
 * default, so a broken file cannot make a profile disappear from the settings
 * page while its selection survives.
 */
function normalizePersistedProfiles(raw: unknown): PersistedExtensionProfiles {
  if (typeof raw !== 'object' || raw === null) return emptyState()
  const source = raw as Record<string, unknown>
  const profiles: PersistedExtensionProfile[] = []
  const seen = new Set<string>()

  if (Array.isArray(source.profiles)) {
    for (const entry of source.profiles) {
      if (typeof entry !== 'object' || entry === null) continue
      const profile = entry as Record<string, unknown>
      if (!isProfileId(profile.id)) continue
      const id = profile.id.trim()
      if (seen.has(id)) continue
      seen.add(id)
      const name = normalizeProfileName(profile.name) || 'Chrome'
      profiles.push({ id, name })
    }
  }

  const selectedProfileId = isProfileId(source.selectedProfileId)
    ? source.selectedProfileId.trim()
    : null
  const selectionVersion =
    typeof source.selectionVersion === 'number' && Number.isFinite(source.selectionVersion)
      ? Math.max(0, Math.floor(source.selectionVersion))
      : 0

  return {
    version: 1,
    selectedProfileId: profiles.some((profile) => profile.id === selectedProfileId)
      ? selectedProfileId
      : null,
    selectionVersion,
    profiles
  }
}

/** The file the profile names and the selection live in. */
function getNativeMessagingProfilesPath(): string {
  return path.join(app.getPath('userData'), FILE_NAME)
}

export class NativeMessagingProfileStore {
  private readonly configuredPath: string | null

  constructor(filePath?: string) {
    this.configuredPath = filePath ?? null
  }

  private get filePath(): string {
    return this.configuredPath ?? getNativeMessagingProfilesPath()
  }

  /**
   * Reads the profile list.
   *
   * A missing file is a fresh install and returns an empty state. A file that
   * exists but cannot be read is an I/O problem: it throws instead of
   * pretending the user has no profiles, so the manager can refuse to
   * overwrite the healthy file with an empty snapshot. Corrupt JSON is
   * different: the bytes cannot be used, so they are moved aside to a backup
   * path before an empty state is returned.
   */
  async load(): Promise<PersistedExtensionProfiles> {
    let raw: string
    try {
      raw = await fs.readFile(this.filePath, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState()
      throw new Error(`The Chrome profile file at ${this.filePath} could not be read.`, {
        cause: error
      })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      await this.preserveCorruptFile(error)
      return emptyState()
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      await this.preserveCorruptFile(new Error('The profile file is not a JSON object.'))
      return emptyState()
    }
    return normalizePersistedProfiles(parsed)
  }

  /**
   * Moves a corrupt file out of the way before the next save creates a new one.
   *
   * The original bytes are the only remaining copy of the user's profile names
   * and selection. If the backup cannot be written, the read fails instead of
   * letting the next save overwrite that copy.
   */
  private async preserveCorruptFile(cause: unknown): Promise<void> {
    const backup = `${this.filePath}.corrupt-${Date.now()}`
    try {
      await fs.rename(this.filePath, backup)
      Logger.warn(
        `[NativeMessaging] The Chrome profile file was corrupt and moved to ${backup}.`,
        cause
      )
    } catch (error) {
      throw new Error(
        `The Chrome profile file at ${this.filePath} is corrupt and could not be preserved.`,
        { cause: error }
      )
    }
  }

  async save(state: PersistedExtensionProfiles): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    // Write next to the target and rename, so a crash cannot leave a
    // half-written file that would silently lose the selection on next start.
    // The unique suffix keeps two app instances from writing the same temp
    // file at once; the manager's queue already serializes this process.
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}.tmp`
    try {
      await fs.writeFile(temporary, JSON.stringify(state, null, 2), 'utf-8')
      await fs.rename(temporary, this.filePath)
    } catch (error) {
      await fs.unlink(temporary).catch(() => {})
      throw error
    }
  }
}
