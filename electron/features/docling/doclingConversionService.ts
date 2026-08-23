import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { app } from 'electron'

import type {
  QuizLabConversionErrorCode,
  QuizLabConversionStatus,
  QuizLabConversionTask,
  QuizLabDocument
} from '../../../shared/types/quizlabDocument.js'
import { Logger } from '../../core/logger.js'
import { adaptDoclingToQuizLabDocument } from './doclingAdapter.js'
import { getModelStatus } from './doclingModelManager.js'
import { getDoclingLayout, getVenvPythonPath } from './doclingPaths.js'
import { doclingServiceManager } from './doclingServiceManager.js'
import {
  computeFileHash,
  copyAssetsToCache,
  getCachedDocument,
  invalidateCache,
  putCachedDocument
} from './quizlabDocumentCache.js'

const TASK_TIMEOUT_MS = 15 * 60 * 1000
const POLL_INTERVAL_MS = 800
const MAX_PDF_SIZE_BYTES = 500 * 1024 * 1024

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

async function validatePdfPath(
  pdfPath: string
): Promise<{ valid: true } | { valid: false; code: QuizLabConversionErrorCode; message: string }> {
  if (typeof pdfPath !== 'string' || pdfPath.length === 0 || pdfPath.length > 4096) {
    return { valid: false, code: 'unknown', message: 'Invalid pdfPath length' }
  }
  if (pdfPath.includes('\0')) return { valid: false, code: 'unknown', message: 'Invalid pdfPath' }
  if (!path.isAbsolute(pdfPath))
    return { valid: false, code: 'unknown', message: 'PDF path must be absolute' }
  if (pdfPath.split(path.sep).includes('..')) {
    return { valid: false, code: 'unknown', message: 'Invalid pdfPath traversal' }
  }
  try {
    const stat = await fs.lstat(pdfPath)
    if (stat.isSymbolicLink())
      return { valid: false, code: 'unknown', message: 'Symlink PDFs are not allowed' }
    if (!stat.isFile()) return { valid: false, code: 'unknown', message: 'Not a file' }
    if (stat.size > MAX_PDF_SIZE_BYTES) {
      return {
        valid: false,
        code: 'unknown',
        message: `PDF too large (${(stat.size / (1024 * 1024)).toFixed(1)} MB > 500 MB)`
      }
    }
    if (stat.size === 0) return { valid: false, code: 'corrupted_pdf', message: 'Empty PDF file' }
  } catch {
    return { valid: false, code: 'corrupted_pdf', message: 'PDF not found or unreadable' }
  }
  if (!pdfPath.toLowerCase().endsWith('.pdf')) {
    return { valid: false, code: 'unsupported_pdf', message: 'File is not a PDF' }
  }
  return { valid: true }
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
      serviceManager: doclingServiceManager,
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

  cancelTask(taskId: string): QuizLabConversionTask | null {
    const t = this.tasks.get(taskId)
    if (!t) return null
    if (t.status === 'queued') {
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
    if (t.status === 'processing') {
      const child = this.children.get(taskId)
      if (child && !child.killed) {
        try {
          child.kill('SIGKILL')
        } catch {}
      }
      this.cancelled.add(taskId)
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
    return { ...t }
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
    this.activeConversions += 1
    let didDecrement = false
    const decrement = (): void => {
      if (!didDecrement) {
        didDecrement = true
        this.activeConversions = Math.max(0, this.activeConversions - 1)
      }
    }
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
      const status = await this.deps.serviceManager.getStatus()
      if (!status.installed) {
        this.updateTask(taskId, {
          status: 'failed',
          error: { code: 'not_installed', message: 'Docling is not installed', details: null }
        })
        return
      }
      try {
        const modelStatus = await getModelStatus()
        if (modelStatus.status !== 'ready') {
          this.updateTask(taskId, {
            status: 'failed',
            error: {
              code: 'model_missing' as unknown as QuizLabConversionErrorCode,
              message: 'Required document models are not installed',
              details: null
            }
          })
          return
        }
      } catch {}
      // Best-effort ensure the sidecar is up for future HTTP path;
      // conversion itself is via direct spawn (convert_docling.py) so a
      // transient service failure should not block the document.
      try {
        await this.deps.serviceManager.ensureRunning()
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        Logger.warn('[DoclingConversion] Service ensure failed, falling back to direct spawn', {
          error: msg
        })
      }
      const venvPython = getVenvPythonPath(layout)
      const outputDir = path.join(layout.temp, 'conversions', taskId)
      const outputJson = path.join(outputDir, 'docling.json')
      const imagesDir = path.join(layout.root, 'documents', taskId, 'images')
      // GPU support removed – always CPU to avoid c10_cuda.dll WinError 127.
      const gpuEnabled = false
      let pipelinePrefs: {
        doOcr: boolean
        ocrLang: string
        forceFullPageOcr: boolean
        detectTables: boolean
        fastTables: boolean
        cellMatching: boolean
        doCodeEnrichment: boolean
        doFormulaEnrichment: boolean
        doPictureClassification: boolean
        doPictureDescription: boolean
        extractFigures: boolean
        generatePageImages: boolean
        generateTableImages: boolean
        imagesScale: number
        doChartExtraction: boolean
        forceBackendText: boolean
        enableRemoteServices: boolean
        allowExternalPlugins: boolean
        documentTimeout: number | null
        numThreads: number
        device: string
        enableHeadingHierarchy: boolean
        ocrBatchSize: number
        layoutBatchSize: number
        tableBatchSize: number
        queueMaxSize: number
      } = {
        doOcr: false,
        ocrLang: '',
        forceFullPageOcr: false,
        detectTables: true,
        fastTables: true,
        cellMatching: true,
        doCodeEnrichment: false,
        doFormulaEnrichment: false,
        doPictureClassification: false,
        doPictureDescription: false,
        extractFigures: false,
        generatePageImages: false,
        generateTableImages: false,
        imagesScale: 1.0,
        doChartExtraction: false,
        forceBackendText: false,
        enableRemoteServices: false,
        allowExternalPlugins: false,
        documentTimeout: null,
        numThreads: 4,
        device: 'auto',
        enableHeadingHierarchy: false,
        ocrBatchSize: 4,
        layoutBatchSize: 4,
        tableBatchSize: 4,
        queueMaxSize: 100
      }
      try {
        const { getPipelinePrefs } = await import('./doclingPipelineSettings.js')
        const p = await getPipelinePrefs()
        pipelinePrefs = {
          doOcr: !!p.doOcr,
          ocrLang: typeof p.ocrLang === 'string' ? p.ocrLang : '',
          forceFullPageOcr: !!p.forceFullPageOcr,
          detectTables: !!p.detectTables,
          fastTables: !!p.fastTables,
          cellMatching: p.cellMatching !== false,
          doCodeEnrichment: !!p.doCodeEnrichment,
          doFormulaEnrichment: !!p.doFormulaEnrichment,
          doPictureClassification: !!p.doPictureClassification,
          doPictureDescription: !!p.doPictureDescription,
          extractFigures: !!p.extractFigures,
          generatePageImages: !!p.generatePageImages,
          generateTableImages: !!p.generateTableImages,
          imagesScale: typeof p.imagesScale === 'number' ? p.imagesScale : 1.0,
          doChartExtraction: !!p.doChartExtraction,
          forceBackendText: !!p.forceBackendText,
          enableRemoteServices: !!p.enableRemoteServices,
          allowExternalPlugins: !!p.allowExternalPlugins,
          documentTimeout: typeof p.documentTimeout === 'number' ? p.documentTimeout : null,
          numThreads: typeof p.numThreads === 'number' ? p.numThreads : 4,
          device: typeof p.device === 'string' ? p.device : 'auto',
          enableHeadingHierarchy: !!p.enableHeadingHierarchy,
          ocrBatchSize: typeof p.ocrBatchSize === 'number' ? p.ocrBatchSize : 4,
          layoutBatchSize: typeof p.layoutBatchSize === 'number' ? p.layoutBatchSize : 4,
          tableBatchSize: typeof p.tableBatchSize === 'number' ? p.tableBatchSize : 4,
          queueMaxSize: typeof p.queueMaxSize === 'number' ? p.queueMaxSize : 100
        }
      } catch {}
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
              DOCLING_GPU_ENABLED: gpuEnabled ? '1' : '0',
              DOCLING_DO_OCR: pipelinePrefs.doOcr ? '1' : '0',
              DOCLING_OCR_LANG: pipelinePrefs.ocrLang,
              DOCLING_FORCE_FULL_PAGE_OCR: pipelinePrefs.forceFullPageOcr ? '1' : '0',
              DOCLING_EXTRACT_FIGURES: pipelinePrefs.extractFigures ? '1' : '0',
              DOCLING_DETECT_TABLES: pipelinePrefs.detectTables ? '1' : '0',
              DOCLING_FAST_TABLES: pipelinePrefs.fastTables ? '1' : '0',
              DOCLING_CELL_MATCHING: pipelinePrefs.cellMatching ? '1' : '0',
              DOCLING_DO_CODE_ENRICHMENT: pipelinePrefs.doCodeEnrichment ? '1' : '0',
              DOCLING_DO_FORMULA_ENRICHMENT: pipelinePrefs.doFormulaEnrichment ? '1' : '0',
              DOCLING_DO_PICTURE_CLASSIFICATION: pipelinePrefs.doPictureClassification ? '1' : '0',
              DOCLING_DO_PICTURE_DESCRIPTION: pipelinePrefs.doPictureDescription ? '1' : '0',
              DOCLING_GENERATE_PAGE_IMAGES: pipelinePrefs.generatePageImages ? '1' : '0',
              DOCLING_GENERATE_TABLE_IMAGES: pipelinePrefs.generateTableImages ? '1' : '0',
              DOCLING_IMAGES_SCALE: String(pipelinePrefs.imagesScale),
              DOCLING_DO_CHART_EXTRACTION: pipelinePrefs.doChartExtraction ? '1' : '0',
              DOCLING_FORCE_BACKEND_TEXT: pipelinePrefs.forceBackendText ? '1' : '0',
              DOCLING_ENABLE_REMOTE_SERVICES: pipelinePrefs.enableRemoteServices ? '1' : '0',
              DOCLING_ALLOW_EXTERNAL_PLUGINS: pipelinePrefs.allowExternalPlugins ? '1' : '0',
              DOCLING_DOCUMENT_TIMEOUT: pipelinePrefs.documentTimeout
                ? String(pipelinePrefs.documentTimeout)
                : '',
              DOCLING_NUM_THREADS: String(pipelinePrefs.numThreads),
              DOCLING_DEVICE: pipelinePrefs.device,
              DOCLING_ENABLE_HEADING_HIERARCHY: pipelinePrefs.enableHeadingHierarchy ? '1' : '0',
              DOCLING_OCR_BATCH_SIZE: String(pipelinePrefs.ocrBatchSize),
              DOCLING_LAYOUT_BATCH_SIZE: String(pipelinePrefs.layoutBatchSize),
              DOCLING_TABLE_BATCH_SIZE: String(pipelinePrefs.tableBatchSize),
              DOCLING_QUEUE_MAX_SIZE: String(pipelinePrefs.queueMaxSize),
              PYTHONUNBUFFERED: '1',
              PYTHONHOME: undefined,
              PYTHONPATH: undefined
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
        let secured = await this.secureImageAssets(doc, taskId, layout, imagesDir)
        if (sourceHash) {
          try {
            await copyAssetsToCache(sourceHash, imagesDir).catch(() => {})
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
        await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
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

  private async ensureConverterScript(
    layout: ReturnType<typeof getDoclingLayout>
  ): Promise<string> {
    const scriptPath = path.join(layout.root, 'service', 'convert_docling.py')
    try {
      await fs.access(scriptPath)
      const stat = await fs.lstat(scriptPath)
      if (stat.isSymbolicLink()) {
        await fs.rm(scriptPath, { force: true })
        throw new Error('Symlink detected')
      }
      const existing = await fs.readFile(scriptPath, 'utf8').catch(() => '')
      if (
        existing.includes('DOCLING_GPU_ENABLED') &&
        existing.includes('IMAGE_EMBED') &&
        existing.includes('DOCLING_DO_OCR')
      )
        return scriptPath
      await fs.rm(scriptPath, { force: true }).catch(() => {})
      throw new Error('Regenerate for 25-opts support')
    } catch {}
    await fs.mkdir(path.dirname(scriptPath), { recursive: true })
    // eslint-disable-next-line no-secrets/no-secrets -- Python script contains env var checks, not secrets
    const script = `
import os, sys, json, pathlib
from pathlib import Path

pdf_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])

if not pdf_path.is_file():
    print(f"PDF not found: {pdf_path}", file=sys.stderr)
    sys.exit(2)
if pdf_path.suffix.lower() != ".pdf":
    print(f"Not a PDF: {pdf_path}", file=sys.stderr)
    sys.exit(3)

def _make_converter():
    # Full 25-pipeline-prefs from Settings – defaults match doclingPipelineSettings.ts
    def _b(name, d=False): return os.environ.get(name) == "1"
    def _f(name, d):
        try: return float(os.environ.get(name, str(d)))
        except: return d
    def _i(name, d):
        try: return int(float(os.environ.get(name, str(d))))
        except: return d
    do_ocr = _b("DOCLING_DO_OCR", False)
    ocr_lang = os.environ.get("DOCLING_OCR_LANG", "").strip()
    force_full_page_ocr = _b("DOCLING_FORCE_FULL_PAGE_OCR", False)
    detect_tables = _b("DOCLING_DETECT_TABLES", True)
    fast_tables = _b("DOCLING_FAST_TABLES", True)
    cell_matching = _b("DOCLING_CELL_MATCHING", True)
    do_code = _b("DOCLING_DO_CODE_ENRICHMENT", False)
    do_formula = _b("DOCLING_DO_FORMULA_ENRICHMENT", False)
    do_pic_class = _b("DOCLING_DO_PICTURE_CLASSIFICATION", False)
    do_pic_desc = _b("DOCLING_DO_PICTURE_DESCRIPTION", False)
    extract_figs = _b("DOCLING_EXTRACT_FIGURES", False)
    gen_page_imgs = _b("DOCLING_GENERATE_PAGE_IMAGES", False)
    gen_table_imgs = _b("DOCLING_GENERATE_TABLE_IMAGES", False)
    images_scale = _f("DOCLING_IMAGES_SCALE", 1.0)
    do_chart = _b("DOCLING_DO_CHART_EXTRACTION", False)
    force_backend_text = _b("DOCLING_FORCE_BACKEND_TEXT", False)
    enable_remote = _b("DOCLING_ENABLE_REMOTE_SERVICES", False)
    allow_plugins = _b("DOCLING_ALLOW_EXTERNAL_PLUGINS", False)
    doc_timeout = _f("DOCLING_DOCUMENT_TIMEOUT", 0) or None
    num_threads = _i("DOCLING_NUM_THREADS", 4)
    device = os.environ.get("DOCLING_DEVICE", "auto").strip() or "auto"
    enable_heading = _b("DOCLING_ENABLE_HEADING_HIERARCHY", False)
    ocr_bs = _i("DOCLING_OCR_BATCH_SIZE", 4)
    layout_bs = _i("DOCLING_LAYOUT_BATCH_SIZE", 4)
    table_bs = _i("DOCLING_TABLE_BATCH_SIZE", 4)
    queue_max = _i("DOCLING_QUEUE_MAX_SIZE", 100)
    try:
        from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode, TableStructureOptions
        from docling.datamodel.accelerator_options import AcceleratorOptions, AcceleratorDevice
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.base_models import InputFormat
        kwargs = dict(
            do_ocr=do_ocr,
            do_table_structure=detect_tables,
            do_code_enrichment=do_code,
            do_formula_enrichment=do_formula,
            do_picture_classification=do_pic_class,
            do_picture_description=do_pic_desc,
            generate_picture_images=extract_figs,
            generate_page_images=gen_page_imgs,
            generate_table_images=gen_table_imgs,
            images_scale=images_scale,
            do_chart_extraction=do_chart,
            force_backend_text=force_backend_text,
            enable_remote_services=enable_remote,
            allow_external_plugins=allow_plugins,
            document_timeout=doc_timeout,
            ocr_batch_size=ocr_bs,
            layout_batch_size=layout_bs,
            table_batch_size=table_bs,
            queue_max_size=queue_max,
            batch_polling_interval_seconds=0.5,
            stage_shutdown_timeout_seconds=15.0,
        )
        # OCR lang
        if ocr_lang:
            try:
                from docling.datamodel.pipeline_options import EasyOcrOptions
                langs = [s.strip() for s in ocr_lang.split(",") if s.strip()]
                kwargs["ocr_options"] = EasyOcrOptions(lang=langs, force_full_page_ocr=force_full_page_ocr)
            except Exception:
                pass
        elif force_full_page_ocr:
            try:
                from docling.datamodel.pipeline_options import EasyOcrOptions
                kwargs["ocr_options"] = EasyOcrOptions(force_full_page_ocr=True)
            except Exception:
                pass
        # Table mode
        if detect_tables:
            try:
                mode = TableFormerMode.FAST if fast_tables else TableFormerMode.ACCURATE
                kwargs["table_structure_options"] = TableStructureOptions(mode=mode, do_cell_matching=cell_matching)
            except Exception:
                pass
        # Accelerator
        try:
            dev = AcceleratorDevice.AUTO if device == "auto" else AcceleratorDevice(device)
        except Exception:
            try: dev = device
            except: dev = "auto"
        try:
            kwargs["accelerator_options"] = AcceleratorOptions(device=dev, num_threads=num_threads)
        except Exception:
            pass
        # Heading hierarchy
        if enable_heading:
            try:
                from docling.datamodel.pipeline_options import HeadingHierarchyOptions
                kwargs["heading_hierarchy_options"] = HeadingHierarchyOptions(enabled=True)
            except Exception:
                pass
        opts = PdfPipelineOptions(**{k: v for k, v in kwargs.items() if v is not None})
        print(f"Pipeline 25-opts ocr={do_ocr} lang={ocr_lang} figs={extract_figs} tables={detect_tables} fast={fast_tables} scale={images_scale} thr={num_threads} dev={device}", flush=True)
        return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)})
    except Exception as e:
        print(f"Pipeline opts failed, fallback to default: {e}", file=sys.stderr, flush=True)
        import traceback; traceback.print_exc(file=sys.stderr)
        from docling.document_converter import DocumentConverter
        return DocumentConverter()

try:
    converter = _make_converter()
    result = converter.convert(str(pdf_path))
    doc = result.document

    has_text = any(t.get("text", "").strip() for t in doc.export_to_dict().get("texts", []))
    if not has_text and os.environ.get("DOCLING_DO_OCR") != "1":
        print("No text found with OCR off – retrying with OCR", flush=True)
        try:
            from docling.datamodel.pipeline_options import PdfPipelineOptions as OcrRetryOpts
            from docling.document_converter import DocumentConverter as OcrConverter, PdfFormatOption as OcrFmt
            from docling.datamodel.base_models import InputFormat as OcrFmtType
            retry_kwargs = dict(do_ocr=True, do_table_structure=os.environ.get("DOCLING_DETECT_TABLES")=="1", generate_picture_images=os.environ.get("DOCLING_EXTRACT_FIGURES")=="1", do_picture_classification=os.environ.get("DOCLING_EXTRACT_FIGURES")=="1", images_scale=1.2)
            if retry_kwargs["do_table_structure"] and os.environ.get("DOCLING_FAST_TABLES")=="1":
                try:
                    from docling.datamodel.pipeline_options import TableFormerMode as OcrTableMode, TableStructureOptions as OcrTableOpts
                    retry_kwargs["table_structure_options"] = OcrTableOpts(mode=OcrTableMode.FAST)
                except Exception:
                    pass
            retry_opts = OcrRetryOpts(**retry_kwargs)
            retry_converter = OcrConverter(format_options={OcrFmtType.PDF: OcrFmt(pipeline_options=retry_opts)})
            retry_result = retry_converter.convert(str(pdf_path))
            doc = retry_result.document
        except Exception as retry_e:
            print(f"OCR retry failed: {retry_e}", file=sys.stderr, flush=True)

    # Embed images as base64 so secureImageAssets can write them to disk and serve via quizlab-asset://
    try:
        from docling.datamodel.document import ImageRefMode
        data = doc.export_to_dict(image_mode=ImageRefMode.EMBEDDED)
    except Exception:
        # Fallback if ImageRefMode not available
        try:
            data = doc.export_to_dict(image_mode="embedded")
        except Exception:
            data = doc.export_to_dict()
except Exception as e:
    msg = str(e).lower()
    if "password" in msg or "encrypted" in msg:
        print(f"encrypted PDF: {e}", file=sys.stderr)
        sys.exit(10)
    if "corrupt" in msg or "damaged" in msg:
        print(f"corrupted PDF: {e}", file=sys.stderr)
        sys.exit(11)
    if "c10_cuda" in msg or "winerror 127" in msg:
        print(f"GPU torch driver missing, retrying with CPU: {e}", file=sys.stderr, flush=True)
        try:
            from docling.document_converter import DocumentConverter as CpuConverter
            cpu_converter = CpuConverter()
            cpu_result = cpu_converter.convert(str(pdf_path))
            cpu_doc = cpu_result.document
            try:
                from docling.datamodel.document import ImageRefMode as CpuImageMode
                cpu_data = cpu_doc.export_to_dict(image_mode=CpuImageMode.EMBEDDED)
            except Exception:
                try:
                    cpu_data = cpu_doc.export_to_dict(image_mode="embedded")
                except Exception:
                    cpu_data = cpu_doc.export_to_dict()
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(cpu_data, f, ensure_ascii=False)
            print(f"CPU fallback succeeded {pdf_path} -> {out_path}", flush=True)
            sys.exit(0)
        except Exception as e2:
            print(f"CPU fallback also failed: {e2}", file=sys.stderr)
            import traceback; traceback.print_exc(file=sys.stderr)
            sys.exit(1)
    print(f"conversion failed: {e}", file=sys.stderr)
    import traceback; traceback.print_exc(file=sys.stderr)
    sys.exit(1)

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

print(f"converted {pdf_path} -> {out_path} (gpu={os.environ.get('DOCLING_GPU_ENABLED')})")
`.trimStart()
    await fs.writeFile(scriptPath, script, 'utf8')
    await fs.chmod(scriptPath, 0o600).catch(() => {})
    return scriptPath
  }

  private async secureImageAssets(
    doc: QuizLabDocument,
    taskId: string,
    layout: ReturnType<typeof getDoclingLayout>,
    imagesDir: string
  ): Promise<QuizLabDocument> {
    const blocks = await Promise.all(
      doc.blocks.map(async (block) => {
        if (block.type !== 'image' || !block.assetUrl) return block
        const url: string = block.assetUrl
        if (!url.startsWith('data:')) {
          if (url.startsWith('file://')) return { ...block, assetUrl: null }
          return block
        }
        try {
          const match = url.match(/^data:image\/[^;]+;base64,(.+)$/)
          if (!match) return block
          const b64 = match[1]
          const buf = Buffer.from(b64, 'base64')
          if (buf.length > 20 * 1024 * 1024) return { ...block, assetUrl: null }
          const ext = url.includes('png')
            ? 'png'
            : url.includes('jpeg') || url.includes('jpg')
              ? 'jpg'
              : 'bin'
          const fileName = `${block.id}.${ext}`
          const filePath = path.join(imagesDir, fileName)
          await fs.mkdir(imagesDir, { recursive: true })
          await fs.writeFile(filePath, buf)
          const secureUrl = `quizlab-asset://docling/${taskId}/images/${fileName}`
          return { ...block, assetUrl: secureUrl, assetId: fileName }
        } catch {
          return { ...block, assetUrl: null }
        }
      })
    )
    return { ...doc, blocks: blocks as QuizLabDocument['blocks'] }
  }

  _clearForTests(): void {
    this.tasks.clear()
    this.results.clear()
    this.activeConversions = 0
  }
}

export const doclingConversionService = new DoclingConversionService()
export type { DoclingConversionService }
