import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import type {
  QuizLabConversionError,
  QuizLabConversionErrorCode,
  QuizLabConversionStatus,
  QuizLabConversionTask,
  QuizLabDocument
} from '../../../shared/types/quizlabDocument.js'
import { Logger } from '../../core/logger.js'
import { adaptDoclingToQuizLabDocument } from './doclingAdapter.js'
import { getDoclingLayout, getVenvPythonPath } from './doclingPaths.js'
import { doclingServiceManager } from './doclingServiceManager.js'
import {
  computeFileHash,
  copyAssetsToCache,
  getCachedDocument,
  putCachedDocument
} from './quizlabDocumentCache.js'

const TASK_TIMEOUT_MS = 5 * 60 * 1000
const POLL_INTERVAL_MS = 800

interface ConversionDeps {
  spawnFn: typeof spawn
  getLayout: typeof getDoclingLayout
  adapter: typeof adaptDoclingToQuizLabDocument
  serviceManager: typeof doclingServiceManager
}

function mapErrorCode(stderr: string, code: number | null): QuizLabConversionErrorCode {
  const lower = stderr.toLowerCase()
  if (lower.includes('encrypted') || lower.includes('password')) return 'encrypted_pdf'
  if (lower.includes('corrupt') || lower.includes('damaged')) return 'corrupted_pdf'
  if (lower.includes('unsupported') || lower.includes('not a pdf')) return 'unsupported_pdf'
  if (lower.includes('timeout') || lower.includes('timed out')) return 'conversion_timeout'
  if (lower.includes('ocr') && lower.includes('fail')) return 'ocr_failure'
  if (code === 2) return 'scanned_pdf_no_text'
  return 'unknown'
}

function createTask(pdfPath: string, status: QuizLabConversionStatus): QuizLabConversionTask {
  const now = Date.now()
  return {
    taskId: `docling-${createHash('sha256').update(`${pdfPath}-${now}-${Math.random()}`).digest('hex').slice(0, 12)}`,
    pdfPath,
    status,
    progress:
      status === 'processing' ? { phase: 'processing', percent: null, message: null } : null,
    error: null,
    createdAt: now,
    updatedAt: now
  }
}

class DoclingConversionService {
  private tasks = new Map<string, QuizLabConversionTask>()
  private results = new Map<string, QuizLabDocument>()
  private deps: ConversionDeps

  constructor(deps: Partial<ConversionDeps> = {}) {
    this.deps = {
      spawnFn: spawn,
      getLayout: getDoclingLayout,
      adapter: adaptDoclingToQuizLabDocument,
      serviceManager: doclingServiceManager,
      ...deps
    }
  }

  async convertPdf(
    pdfPath: string,
    options: { force?: boolean } = {}
  ): Promise<QuizLabConversionTask> {
    const layout = this.deps.getLayout()
    const task = createTask(pdfPath, 'queued')
    this.tasks.set(task.taskId, task)

    // Fire-and-forget processing (caller polls getTask)
    void this.processTask(task.taskId, layout, options).catch((error) => {
      Logger.error('[DoclingConversion] Unhandled task error', error)
    })

    return { ...task }
  }

  async reconvertPdf(pdfPath: string): Promise<QuizLabConversionTask> {
    try {
      const hash = await computeFileHash(pdfPath)
      const { invalidateCache } = await import('./quizlabDocumentCache.js')
      await invalidateCache(hash)
    } catch {}
    return this.convertPdf(pdfPath, { force: true })
  }

  getTask(taskId: string): QuizLabConversionTask | null {
    const t = this.tasks.get(taskId)
    return t ? { ...t } : null
  }

  getResult(taskId: string): QuizLabDocument | null {
    const doc = this.results.get(taskId)
    return doc ? { ...doc, blocks: [...doc.blocks], pages: [...doc.pages] } : null
  }

  private updateTask(
    taskId: string,
    patch: Partial<QuizLabConversionTask>
  ): QuizLabConversionTask | null {
    const cur = this.tasks.get(taskId)
    if (!cur) return null
    const next: QuizLabConversionTask = { ...cur, ...patch, updatedAt: Date.now() }
    this.tasks.set(taskId, next)
    return next
  }

  private async processTask(
    taskId: string,
    layout: ReturnType<typeof getDoclingLayout>,
    options: { force?: boolean } = {}
  ): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) return

    this.updateTask(taskId, {
      status: 'processing',
      progress: { phase: 'processing', percent: null, message: null }
    })

    // Try cache first (unless forced)
    let sourceHash: string | null = null
    if (!options.force) {
      try {
        sourceHash = await computeFileHash(task.pdfPath)
        const cached = await getCachedDocument(sourceHash)
        if (cached) {
          this.results.set(taskId, cached)
          this.updateTask(taskId, {
            status: 'completed',
            progress: { phase: 'completed', percent: 100, message: 'cache hit' }
          })
          return
        }
      } catch (error) {
        Logger.warn('[DoclingConversion] Cache lookup failed', { error: String(error) })
        sourceHash = null
      }
    } else {
      try {
        sourceHash = await computeFileHash(task.pdfPath)
      } catch {}
    }

    // Ensure runtime installed
    const status = await this.deps.serviceManager.getStatus()
    if (!status.installed) {
      this.updateTask(taskId, {
        status: 'failed',
        error: { code: 'not_installed', message: 'Docling is not installed', details: null }
      })
      return
    }

    // Ensure service running (lazy)
    try {
      await this.deps.serviceManager.ensureRunning()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.updateTask(taskId, {
        status: 'failed',
        error: { code: 'service_unavailable', message: msg, details: null }
      })
      return
    }

    // Run conversion via isolated python one-shot (no shell)
    const venvPython = getVenvPythonPath(layout)
    const outputDir = path.join(layout.temp, 'conversions', taskId)
    const outputJson = path.join(outputDir, 'docling.json')
    const imagesDir = path.join(layout.root, 'documents', taskId, 'images')

    try {
      await fs.mkdir(outputDir, { recursive: true })
      await fs.mkdir(imagesDir, { recursive: true })

      const converterScript = await this.ensureConverterScript(layout)

      const deadline = Date.now() + TASK_TIMEOUT_MS
      const child = this.deps.spawnFn(
        venvPython,
        [converterScript, task.pdfPath, outputJson, imagesDir],
        {
          shell: false,
          windowsHide: true,
          env: {
            ...process.env,
            DOCLING_ARTIFACTS_PATH: layout.models,
            PYTHONUNBUFFERED: '1',
            PYTHONHOME: undefined,
            PYTHONPATH: undefined
          } as NodeJS.ProcessEnv
        }
      )

      let stderr = ''
      child.stderr?.on('data', (c: Buffer) => {
        stderr += c.toString('utf8')
        if (stderr.length > 200_000) stderr = stderr.slice(-200_000)
      })

      const exitCode: number | null = await Promise.race([
        new Promise<number | null>((resolve, reject) => {
          child.once('error', reject)
          child.once('exit', (code) => resolve(code))
        }),
        (async () => {
          while (Date.now() < deadline) {
            if (child.exitCode !== null || child.signalCode !== null) break
            await delay(POLL_INTERVAL_MS)
          }
          if (Date.now() >= deadline) {
            try {
              child.kill('SIGKILL')
            } catch {}
            throw new Error('conversion_timeout')
          }
          // Wait for exit after deadline check
          return new Promise<number | null>((resolve) => child.once('exit', resolve))
        })()
      ])

      if (exitCode !== 0) {
        const code = mapErrorCode(stderr, exitCode)
        const message =
          code === 'conversion_timeout'
            ? 'Conversion timed out'
            : stderr.slice(-2000) || `Docling exited with code ${exitCode}`
        this.updateTask(taskId, {
          status: 'failed',
          error: { code, message, details: stderr.slice(-4000) || null }
        })
        return
      }

      const raw = await fs.readFile(outputJson, 'utf8').catch(() => null)
      if (!raw) throw new Error('Docling produced no output')

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error('Docling output is not valid JSON')
      }

      // Post-process images: move embedded base64 to asset files if needed
      const doc = this.deps.adapter(parsed, {
        pdfPath: task.pdfPath,
        pdfName: path.basename(task.pdfPath),
        conversionTimeMs: Date.now() - task.createdAt
      })

      // Rewrite image assetUrls to secure protocol
      let secured = await this.secureImageAssets(doc, taskId, layout, imagesDir)

      // Cache the result atomically (if we have a content hash)
      if (sourceHash) {
        try {
          // Copy image assets to cache and rewrite URLs to cache host
          const cachedAssetsDir = path.join(
            (await import('electron')).app.getPath('userData'),
            'document-cache',
            sourceHash,
            'assets'
          )
          // Already have images in imagesDir, copy to cache
          await copyAssetsToCache(sourceHash, imagesDir).catch(() => {})
          // Rewrite assetUrls from taskId-based to cache-based for the cached copy
          const cachedBlocks = secured.blocks.map((b) => {
            if (
              b.type === 'image' &&
              b.assetUrl?.startsWith(`quizlab-asset://docling/${taskId}/`)
            ) {
              const fileName = b.assetId ?? b.assetUrl.split('/').pop() ?? ''
              return {
                ...b,
                assetUrl: `quizlab-asset://docling-cache/${sourceHash}/assets/${fileName}`
              }
            }
            return b
          })
          const cachedDoc: QuizLabDocument = {
            ...secured,
            blocks: cachedBlocks as QuizLabDocument['blocks'],
            source: { ...secured.source, fileHash: sourceHash }
          }
          await putCachedDocument(sourceHash, cachedDoc)
          // Also update the in-memory result to use cache URLs for consistency
          secured = cachedDoc
        } catch (error) {
          Logger.warn('[DoclingConversion] Cache write failed', { error: String(error) })
        }
      }

      this.results.set(taskId, secured)
      this.updateTask(taskId, {
        status: 'completed',
        progress: { phase: 'completed', percent: 100, message: null }
      })
      // Cleanup temp json
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      let code: QuizLabConversionErrorCode = 'unknown'
      if (msg === 'conversion_timeout') code = 'conversion_timeout'
      else if (msg.includes('Docling produced')) code = 'docling_crash'
      this.updateTask(taskId, {
        status: 'failed',
        error: { code, message: msg, details: null }
      })
    }
  }

  private async ensureConverterScript(
    layout: ReturnType<typeof getDoclingLayout>
  ): Promise<string> {
    const scriptPath = path.join(layout.root, 'service', 'convert_docling.py')
    try {
      await fs.access(scriptPath)
      return scriptPath
    } catch {}
    await fs.mkdir(path.dirname(scriptPath), { recursive: true })
    const script = `
import sys, json, pathlib
from docling.document_converter import DocumentConverter

pdf_path = sys.argv[1]
out_path = sys.argv[2]
images_dir = sys.argv[3] if len(sys.argv) > 3 else None

converter = DocumentConverter()
result = converter.convert(pdf_path)
doc = result.document

# Lossless structured JSON, not markdown
data = doc.export_to_dict()

# Try to ensure image_export_mode placeholder handling is lossless;
# actual image files are already referenced via pictures[].image.uri if embedded
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

print(f"converted {pdf_path} -> {out_path}")
`.trimStart()
    await fs.writeFile(scriptPath, script, 'utf8')
    return scriptPath
  }

  private async secureImageAssets(
    doc: QuizLabDocument,
    taskId: string,
    layout: ReturnType<typeof getDoclingLayout>,
    imagesDir: string
  ): Promise<QuizLabDocument> {
    // Images are already referenced as assetUrl data: URIs. For now, keep them
    // as-is but rewrite to a secure quizlab-asset:// URL and ensure the bytes
    // live under the task's imagesDir if they were base64.
    // Full extraction (base64 -> file) is handled lazily: if assetUrl starts
    // with data:, decode and write.
    const blocks = await Promise.all(
      doc.blocks.map(async (block) => {
        if (block.type !== 'image' || !block.assetUrl) return block
        const url: string = block.assetUrl
        if (!url.startsWith('data:')) {
          // Already a path or http url – keep but validate it is not arbitrary file://
          if (url.startsWith('file://')) {
            return { ...block, assetUrl: null }
          }
          return block
        }
        try {
          const match = url.match(/^data:image\/[^;]+;base64,(.+)$/)
          if (!match) return block
          const b64 = match[1]
          const buf = Buffer.from(b64, 'base64')
          if (buf.length > 20 * 1024 * 1024) return { ...block, assetUrl: null } // 20MB cap
          const ext = url.includes('png')
            ? 'png'
            : url.includes('jpeg') || url.includes('jpg')
              ? 'jpg'
              : 'bin'
          const fileName = `${block.id}.${ext}`
          const filePath = path.join(imagesDir, fileName)
          await fs.mkdir(imagesDir, { recursive: true })
          await fs.writeFile(filePath, buf)
          // Secure protocol – never file://
          const secureUrl = `quizlab-asset://docling/${taskId}/images/${fileName}`
          return { ...block, assetUrl: secureUrl, assetId: fileName }
        } catch {
          return { ...block, assetUrl: null }
        }
      })
    )
    return { ...doc, blocks: blocks as QuizLabDocument['blocks'] }
  }

  // Test helpers
  _clearForTests(): void {
    this.tasks.clear()
    this.results.clear()
  }
}

export const doclingConversionService = new DoclingConversionService()
export type { DoclingConversionService }
