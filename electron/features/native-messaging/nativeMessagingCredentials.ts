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
   */
  static async loadOrCreateSharedSecret(): Promise<string> {
    const secretPath = this.resolveSharedSecretPath()
    try {
      const raw = await fs.readFile(secretPath, 'utf-8')
      const parsed = JSON.parse(raw) as { secret?: unknown }
      if (typeof parsed.secret === 'string' && /^[0-9a-f]{64}$/.test(parsed.secret)) {
        return parsed.secret
      }
    } catch {
      // Missing or unreadable: fall through and create a fresh one.
    }

    const secret = crypto.randomBytes(32).toString('hex')
    await fs.mkdir(path.dirname(secretPath), { recursive: true })
    await fs.writeFile(secretPath, JSON.stringify({ secret }, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    })
    return secret
  }
}
