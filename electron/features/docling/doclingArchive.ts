import { type Dirent, promises as fs } from 'node:fs'
import path from 'node:path'

import { runCommandChecked } from './doclingProcessRunner.js'

/**
 * Archive extraction for installer artifacts using the operating system's own
 * `tar` binary (bsdtar on Windows also handles .zip). No npm dependencies are
 * added for this.
 *
 * SECURITY: extraction happens into a throwaway directory and the installer
 * cherry-picks only the exact expected file name from it — anything else the
 * archive may contain (including zip-slip paths) is ignored and deleted.
 */

export function resolveSystemTar(): string {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
    return path.join(systemRoot, 'System32', 'tar.exe')
  }
  return '/usr/bin/tar'
}

export async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  const tar = resolveSystemTar()
  await fs.mkdir(destDir, { recursive: true })
  await runCommandChecked(tar, ['-xf', archivePath, '-C', destDir], { timeoutMs: 10 * 60 * 1000 })
}

/** Breadth-limited recursive search for an exactly named file. */
export async function findFileNamed(
  dir: string,
  filename: string,
  depth = 3
): Promise<string | null> {
  if (depth < 0) return null
  let entries: Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === filename) return full
    if (entry.isDirectory()) {
      const found = await findFileNamed(full, filename, depth - 1)
      if (found) return found
    }
  }
  return null
}
