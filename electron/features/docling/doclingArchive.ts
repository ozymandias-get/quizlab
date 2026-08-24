import { type Dirent, promises as fs } from 'node:fs'
import path from 'node:path'

import type { QuizLabDocument } from '../../../shared/types/quizlabDocument.js'
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

/**
 * Export a QuizLabDocument to Markdown / HTML / JSON via the Docling JSON → QuizLab adapter.
 * The caller provides the already-converted QuizLabDocument; no re-conversion happens.
 */
export async function exportDocumentAs(
  doc: QuizLabDocument,
  format: 'markdown' | 'html' | 'json',
  destPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(destPath), { recursive: true })
  if (format === 'json') {
    await fs.writeFile(destPath, JSON.stringify(doc, null, 2), 'utf8')
    return
  }
  // For markdown/html we serialize blocks in reading order – minimal but faithful
  const lines: string[] = []
  for (const block of doc.blocks) {
    if (block.type === 'heading') {
      const lvl = (block as { level: number }).level ?? 1
      lines.push(`${'#'.repeat(Math.min(6, lvl))} ${(block as { text: string }).text}`)
    } else if (
      block.type === 'paragraph' ||
      block.type === 'list_item' ||
      block.type === 'caption'
    ) {
      lines.push((block as { text: string }).text)
    } else if (block.type === 'code') {
      lines.push('```\n' + (block as { text: string }).text + '\n```')
    } else if (block.type === 'formula') {
      lines.push(`$$${(block as { text: string }).text}$$`)
    } else if (block.type === 'table') {
      const rows = (block as { rows: { text: string }[][] }).rows
      if (rows.length > 0) {
        // Markdown table
        lines.push('| ' + rows[0].map((c) => c.text || ' ').join(' | ') + ' |')
        lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |')
        for (let r = 1; r < rows.length; r++) {
          lines.push('| ' + rows[r].map((c) => c.text || ' ').join(' | ') + ' |')
        }
      }
    } else if (block.type === 'image') {
      const alt = (block as { alt: string | null }).alt ?? ''
      lines.push(`![${alt}](${block.assetUrl ?? ''})`)
    }
  }
  const content =
    format === 'markdown'
      ? lines.join('\n\n')
      : `<!DOCTYPE html><html><body>\n${lines.map((l) => `<p>${l.replaceAll('<', '&lt;')}</p>`).join('\n')}\n</body></html>`
  await fs.writeFile(destPath, content, 'utf8')
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
