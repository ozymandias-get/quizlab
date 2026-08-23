import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { DOCLING_TASK_TIMEOUT_MS } from '../../../shared/constants/doclingPipeline.js'
import type {
  QuizLabConversionErrorCode,
  QuizLabConversionStatus,
  QuizLabConversionTask,
  QuizLabDocument
} from '../../../shared/types/quizlabDocument.js'
import { Logger } from '../../core/logger.js'
import { adaptDoclingToQuizLabDocument } from './doclingAdapter.js'
import { buildConverterEnv } from './doclingConversionEnv.js'
import { ensureConverterScript } from './doclingConverterScript.js'
import { getModelStatus } from './doclingModelManager.js'
import { getDoclingLayout, getVenvPythonPath } from './doclingPaths.js'
import { mapErrorCode, validatePdfPath } from './doclingValidation.js'

const POLL_INTERVAL_MS = 800

interface ConversionDeps {
  spawnFn: typeof spawn
  getLayout: typeof getDoclingLayout
  adapter: typeof adaptDoclingToQuizLabDocument
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
  private activeConversions = 0
  private readonly MAX_CONCURRENT = 1
  private children = new Map<string, ReturnType<typeof spawn>>()
  private cancelled = new Set<string>()
  private deps: ConversionDeps

  constructor(deps: Partial<ConversionDeps> = {}) {
    this.deps = {
      spawnFn: spawn,
      getLayout: getDoclingLayout,
      adapter: adaptDoclingToQuizLabDocument,
      ...deps
    }
  }

  async convertPdf(
    pdfPath: string,
    options: { force?: boolean } = {}
  ): Promise<QuizLabConversionTask> {
    if (this.activeConversions >= this.MAX_CONCURRENT) {
      // Same PDF already converting? Reuse it instead of erroring – avoids
      // "Too many concurrent" flash when user double-clicks or when
      // useDocumentConversion retries while a task is still queued.
      for (const existing of this.tasks.values()) {
        if (
          existing.pdfPath === pdfPath &&
          (existing.status === 'queued' || existing.status === 'processing')
        ) {
          Logger.info('[DoclingConversion] Reusing existing task for same PDF', {
            pdfPath,
            taskId: existing.taskId
          })
          return { ...existing }
        }
      }
      throw new Error('Başka bir dönüşüm devam ediyor, lütfen bekleyin')
    }
    const layout = this.deps.getLayout()
    const task = createTask(pdfPath, 'queued')
    this.tasks.set(task.taskId, task)
    void this.processTask(task.taskId, layout, options).catch((error) => {
      Logger.error('[DoclingConversion] Unhandled task error', error)
    })
    return { ...task }
  }

  async reconvertPdf(pdfPath: string): Promise<QuizLabConversionTask> {
    const { computeFileHash, invalidateCache } = await import('./quizlabDocumentCache.js')
    try {
      const hash = await computeFileHash(pdfPath)
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

  /**
   * Cancel a task and wait until its process has actually terminated (or the
   * grace timeout expires). Callers can start a new conversion right after
   * awaiting this without racing the single-conversion slot.
   */
  async cancelTask(taskId: string, timeoutMs = 3000): Promise<QuizLabConversionTask | null> {
    const t = this.tasks.get(taskId)
    if (!t) return null
    if (t.status !== 'queued' && t.status !== 'processing') return { ...t }

    this.cancelled.add(taskId)
    if (t.status === 'processing') {
      const child = this.children.get(taskId)
      if (child && !child.killed) {
        try {
          child.kill('SIGKILL')
        } catch {}
      }
      await this.waitForExit(child, timeoutMs)
    }
    const next: QuizLabConversionTask = {
      ...t,
      status: 'failed',
      error: {
        code: 'cancelled' as QuizLabConversionErrorCode,
        message: 'Conversion cancelled',
        details: null
      },
      updatedAt: Date.now()
    }
    this.tasks.set(taskId, next)
    return { ...next }
  }

  private waitForExit(
    child: ReturnType<typeof spawn> | undefined,
    timeoutMs: number
  ): Promise<void> {
    if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs)
      const done = (): void => {
        clearTimeout(timer)
        resolve()
      }
      child.once('exit', done)
      child.once('error', done)
    })
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

  /** Engine readiness without touching the (decoupled) sidecar layer. */
  private async assertEngineReady(
    layout: ReturnType<typeof getDoclingLayout>
  ): Promise<string | null> {
    const { readDoclingManifest } = await import('./doclingManifest.js')
    const manifest = await readDoclingManifest(layout)
    if (manifest.status !== 'ready') return 'Docling is not installed'
    const venvPython = getVenvPythonPath(layout)
    try {
      await fs.access(venvPython)
    } catch {
      return 'Docling runtime is missing – repair the installation'
    }
    return null
  }

  private async loadPipelinePrefs(): Promise<ReturnType<typeof buildConverterEnv>> {
    let raw: Parameters<typeof buildConverterEnv>[0] = {}
    try {
      const { getPipelinePrefs } = await import('./doclingPipelineSettings.js')
      raw = (await getPipelinePrefs()) as Parameters<typeof buildConverterEnv>[0]
    } catch (error) {
      Logger.warn('[DoclingConversion] Pipeline prefs unavailable, using defaults', {
        error: String(error)
      })
    }
    return buildConverterEnv(raw)
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
    this.activeConversions += 1
    let didDecrement = false
    const decrement = (): void => {
      if (!didDecrement) {
        didDecrement = true
        this.activeConversions = Math.max(0, this.activeConversions - 1)
      }
    }
    const outputDir = path.join(layout.temp, 'conversions', taskId)
    const imagesDir = path.join(layout.root, 'documents', taskId, 'images')
    try {
      const validation = await validatePdfPath(task.pdfPath)
      if (!validation.valid) {
        this.updateTask(taskId, {
          status: 'failed',
          error: { code: validation.code, message: validation.message, details: null }
        })
        return
      }
      let sourceHash: string | null = null
      try {
        const { computeFileHash } = await import('./quizlabDocumentCache.js')
        sourceHash = await computeFileHash(task.pdfPath)
      } catch {}
      if (!options.force && sourceHash) {
        try {
          const cached = await (
            await import('./quizlabDocumentCache.js')
          ).getCachedDocument(sourceHash)
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
      }
      const notReady = await this.assertEngineReady(layout)
      if (notReady) {
        this.updateTask(taskId, {
          status: 'failed',
          error: { code: 'not_installed', message: notReady, details: null }
        })
        return
      }
      try {
        const modelStatus = await getModelStatus()
        if (modelStatus.status !== 'ready') {
          this.updateTask(taskId, {
            status: 'failed',
            error: {
              code: 'model_missing',
              message:
                modelStatus.status === 'runtime_missing'
                  ? 'Docling runtime is missing – repair the installation'
                  : 'Required document models are not installed',
              details: null
            }
          })
          return
        }
      } catch {}

      const envBase = await this.loadPipelinePrefs()
      try {
        if (this.cancelled.has(taskId)) {
          this.cancelled.delete(taskId)
          return
        }
        await fs.mkdir(outputDir, { recursive: true })
        await fs.mkdir(imagesDir, { recursive: true })
        if (this.cancelled.has(taskId)) {
          this.cancelled.delete(taskId)
          return
        }
        const converterScript = await ensureConverterScript(layout)
        const venvPython = getVenvPythonPath(layout)
        const deadline = Date.now() + DOCLING_TASK_TIMEOUT_MS
        const child = this.deps.spawnFn(
          venvPython,
          [converterScript, task.pdfPath, path.join(outputDir, 'docling.json'), imagesDir],
          {
            shell: false,
            windowsHide: true,
            env: {
              ...process.env,
              ...envBase,
              DOCLING_ARTIFACTS_PATH: layout.models
            } as NodeJS.ProcessEnv
          }
        )
        this.children.set(taskId, child)
        child.once('exit', () => this.children.delete(taskId))
        child.once('error', () => this.children.delete(taskId))
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
              if (this.cancelled.has(taskId)) {
                try {
                  child.kill('SIGKILL')
                } catch {}
                // Wait briefly for exit then return sentinel
                await delay(200)
                return 130 as unknown as number | null
              }
              await delay(POLL_INTERVAL_MS)
            }
            if (Date.now() >= deadline) {
              try {
                child.kill('SIGKILL')
              } catch {}
              throw new Error('conversion_timeout')
            }
            return new Promise<number | null>((resolve) => child.once('exit', resolve))
          })()
        ])
        if (this.cancelled.has(taskId)) {
          this.cancelled.delete(taskId)
          this.children.delete(taskId)
          // Task already marked as cancelled by cancelTask – do not overwrite
          await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
          await fs.rm(imagesDir, { recursive: true, force: true }).catch(() => {})
          return
        }
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
        await this.finishConversion(taskId, outputDir, imagesDir, sourceHash)
      } catch (error) {
        if (this.cancelled.has(taskId)) {
          this.cancelled.delete(taskId)
          // Already marked as cancelled – keep that status
          await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
          await fs.rm(imagesDir, { recursive: true, force: true }).catch(() => {})
          return
        }
        const msg = error instanceof Error ? error.message : String(error)
        let code: QuizLabConversionErrorCode = 'unknown'
        if (msg === 'conversion_timeout') code = 'conversion_timeout'
        else if (msg.includes('Docling produced')) code = 'docling_crash'
        this.updateTask(taskId, { status: 'failed', error: { code, message: msg, details: null } })
      }
    } finally {
      this.children.delete(taskId)
      this.cancelled.delete(taskId)
      decrement()
    }
  }

  private async finishConversion(
    taskId: string,
    outputDir: string,
    imagesDir: string,
    sourceHash: string | null,
    layout: ReturnType<typeof getDoclingLayout> = this.deps.getLayout()
  ): Promise<void> {
    const task = this.tasks.get(taskId)!
    const outputJson = path.join(outputDir, 'docling.json')
    const raw = await fs.readFile(outputJson, 'utf8').catch(() => null)
    if (!raw) throw new Error('Docling produced no output')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('Docling output is not valid JSON')
    }
    const doc = this.deps.adapter(parsed, {
      pdfPath: task.pdfPath,
      pdfName: path.basename(task.pdfPath),
      conversionTimeMs: Date.now() - task.createdAt
    })
    let secured = await this.secureImageAssets(doc, taskId, imagesDir)
    if (sourceHash) {
      secured = await this.cacheResult(sourceHash, secured, taskId, imagesDir)
      // Artık docling-cache’e kopyalandı – documents/<taskId> leak olmasın
      // diye kaynak klasörü temizle. Cache-miss durumunda görsellerin
      // quizlab-asset://docling/<taskId>/ üzerinden yaşaması gerekir, o
      // yüzden hash yoksa silme.
      await fs
        .rm(path.join(layout.root, 'documents', taskId), { recursive: true, force: true })
        .catch(() => {})
    }
    this.results.set(taskId, secured)
    this.updateTask(taskId, {
      status: 'completed',
      progress: { phase: 'completed', percent: 100, message: null }
    })
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }

  private async cacheResult(
    sourceHash: string,
    doc: QuizLabDocument,
    taskId: string,
    imagesDir: string
  ): Promise<QuizLabDocument> {
    try {
      const cache = await import('./quizlabDocumentCache.js')
      await cache.copyAssetsToCache(sourceHash, imagesDir).catch(() => {})
      const cachedBlocks = doc.blocks.map((b) => {
        if (b.type === 'image' && b.assetUrl?.startsWith(`quizlab-asset://docling/${taskId}/`)) {
          const fileName = b.assetId ?? b.assetUrl.split('/').pop() ?? ''
          return {
            ...b,
            assetUrl: `quizlab-asset://docling-cache/${sourceHash}/assets/${fileName}`
          }
        }
        return b
      })
      const cachedDoc: QuizLabDocument = {
        ...doc,
        blocks: cachedBlocks as QuizLabDocument['blocks'],
        source: { ...doc.source, fileHash: sourceHash }
      }
      await cache.putCachedDocument(sourceHash, cachedDoc)
      return cachedDoc
    } catch (error) {
      Logger.warn('[DoclingConversion] Cache write failed', { error: String(error) })
      return doc
    }
  }

  /**
   * Convert image references into sandboxed quizlab-asset:// URLs.
   *
   * The Python converter exports images as real files under imagesDir and
   * puts absolute file paths into the JSON; legacy data-URI output is still
   * accepted and written to disk here. Anything outside imagesDir is dropped.
   */
  private async secureImageAssets(
    doc: QuizLabDocument,
    taskId: string,
    imagesDir: string
  ): Promise<QuizLabDocument> {
    const normalizedImagesDir = path.normalize(imagesDir).toLowerCase()
    type ImageBlock = Extract<QuizLabDocument['blocks'][number], { type: 'image' }>
    const blocks = await Promise.all(
      doc.blocks.map(async (block): Promise<QuizLabDocument['blocks'][number]> => {
        if (block.type !== 'image' || !block.assetUrl) return block
        const image = block as ImageBlock
        const url = image.assetUrl as string
        try {
          if (url.startsWith('data:')) {
            const match = url.match(/^data:image\/[^;]+;base64,(.+)$/)
            if (!match) return { ...image, assetUrl: null }
            const buf = Buffer.from(match[1], 'base64')
            if (buf.length > 20 * 1024 * 1024) return { ...image, assetUrl: null }
            const ext = url.includes('png')
              ? 'png'
              : url.includes('jpeg') || url.includes('jpg')
                ? 'jpg'
                : url.includes('webp')
                  ? 'webp'
                  : 'bin'
            return await this.writeAsset(buf, ext, image, taskId, imagesDir)
          }
          // File reference exported by the Python asset exporter.
          let filePath: string | null = null
          if (url.startsWith('file://')) {
            try {
              filePath = decodeURIComponent(new URL(url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
            } catch {
              filePath = null
            }
          } else if (path.isAbsolute(url)) {
            filePath = url
          } else if (url.startsWith('quizlab-asset://')) {
            return image
          }
          if (!filePath) return { ...image, assetUrl: null }
          const normalized = path.normalize(filePath)
          if (normalized.toLowerCase().startsWith(normalizedImagesDir)) {
            const fileName = path.basename(normalized)
            const stat = await fs.lstat(normalized).catch(() => null)
            if (!stat || stat.isSymbolicLink() || !stat.isFile()) {
              return { ...image, assetUrl: null }
            }
            return {
              ...image,
              assetUrl: `quizlab-asset://docling/${taskId}/images/${fileName}`,
              assetId: fileName
            }
          }
          // Outside the sandboxed dir – refuse to serve.
          return { ...image, assetUrl: null }
        } catch {
          return { ...image, assetUrl: null }
        }
      })
    )
    return { ...doc, blocks: blocks as QuizLabDocument['blocks'] }
  }

  private async writeAsset(
    buf: Buffer,
    ext: string,
    block: Extract<QuizLabDocument['blocks'][number], { type: 'image' }>,
    taskId: string,
    imagesDir: string
  ): Promise<QuizLabDocument['blocks'][number]> {
    const fileName = `${block.id}.${ext}`
    await fs.mkdir(imagesDir, { recursive: true })
    await fs.writeFile(path.join(imagesDir, fileName), buf)
    return {
      ...block,
      assetUrl: `quizlab-asset://docling/${taskId}/images/${fileName}`,
      assetId: fileName
    }
  }

  _clearForTests(): void {
    this.tasks.clear()
    this.results.clear()
    this.activeConversions = 0
  }
}

export const doclingConversionService = new DoclingConversionService()
export type { DoclingConversionService }
