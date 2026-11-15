import crypto from 'crypto'
import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * The persistent credentials of the bridge.
 *
 * The app and the separately installed extension share one secret. The user
 * reads it from the settings page as a pairing code and pastes it into the
 * extension popup; the extension signs every request with it. The secret is
 * kept in the app's user data and is never written into the extension package
 * or handed out over HTTP.
 */
export class NativeMessagingCredentials {
  /** The app-side copy of the shared secret. */
  static resolveSharedSecretPath(): string {
    return path.join(app.getPath('userData'), 'bridge-secret.json')
  }

  /**
   * Reads the persisted bridge secret, creating it once when it is missing.
   *
   * The secret must survive an app restart: the paired extension keeps the
   * copy it was given and signs every request with it. A new secret on every
   * start would make every stored copy stale.
   *
   * A corrupt or unreadable file is not treated as "missing": regenerating it
   * would silently unpair the extension and discard the only copy of the
   * secret the app and the extension share. The caller disables the bridge
   * instead.
   */
  static async loadOrCreateSharedSecret(): Promise<string> {
    const secretPath = this.resolveSharedSecretPath()
    const existing = await this.readSecret(secretPath)

    if (existing.kind === 'ok') return existing.secret
    if (existing.kind === 'invalid') {
      throw new Error(`The bridge secret at ${secretPath} is invalid; refusing to replace it.`)
    }
    if (existing.kind === 'error') {
      throw new Error(`The bridge secret at ${secretPath} could not be read.`, {
        cause: existing.error
      })
    }

    const secret = crypto.randomBytes(32).toString('hex')
    const content = JSON.stringify({ secret }, null, 2)
    await fs.mkdir(path.dirname(secretPath), { recursive: true })

    // Write the complete file next to the target first, then create the target
    // with a hard link. The link is atomic and exclusive: two instances that
    // start together cannot both create the file, and the loser reads the
    // winner's complete secret instead of overwriting it.
    const temporary = `${secretPath}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}.tmp`
    try {
      await fs.writeFile(temporary, content, { encoding: 'utf-8', mode: 0o600 })

      try {
        await fs.link(temporary, secretPath)
        return secret
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          // A volume without hard links: the exclusive open still guarantees
          // that only one instance creates the file.
          try {
            await fs.writeFile(secretPath, content, {
              encoding: 'utf-8',
              mode: 0o600,
              flag: 'wx'
            })
            return secret
          } catch (writeError) {
            if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError
          }
        }
      }
    } finally {
      await fs.unlink(temporary).catch(() => {})
    }

    // Another instance created the file between our read and our link. Its
    // write is complete because the link only exposes a fully written temp
    // file; the short retry only covers the exclusive-open fallback.
    const winner = await this.readSecretWithRetry(secretPath)
    if (winner.kind === 'ok') return winner.secret
    throw new Error(
      `The bridge secret at ${secretPath} was created concurrently but could not be read.`
    )
  }

  private static async readSecret(
    secretPath: string
  ): Promise<
    | { kind: 'ok'; secret: string }
    | { kind: 'missing' }
    | { kind: 'invalid' }
    | { kind: 'error'; error: unknown }
  > {
    let raw: string
    try {
      raw = await fs.readFile(secretPath, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' }
      return { kind: 'error', error }
    }

    try {
      const parsed = JSON.parse(raw) as { secret?: unknown }
      if (typeof parsed?.secret === 'string' && /^[0-9a-f]{64}$/.test(parsed.secret)) {
        return { kind: 'ok', secret: parsed.secret }
      }
    } catch {
      // A file that exists but is not a secret is corrupt, not missing.
    }
    return { kind: 'invalid' }
  }

  private static async readSecretWithRetry(
    secretPath: string
  ): Promise<Awaited<ReturnType<typeof NativeMessagingCredentials.readSecret>>> {
    let last: Awaited<ReturnType<typeof NativeMessagingCredentials.readSecret>> = {
      kind: 'missing'
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      last = await this.readSecret(secretPath)
      // A hard-link winner is complete; only the exclusive-open fallback can
      // expose a file that is still being written. Retry that short window.
      if (last.kind === 'ok' || last.kind === 'error') return last
      await new Promise<void>((resolve) => setTimeout(resolve, 10))
    }
    return last
  }
}
