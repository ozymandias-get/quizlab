import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DoclingDirLayout } from './doclingPaths.js'

/**
 * The Python conversion entry point, generated into the component directory.
 *
 * Contract with the Node side (doclingConversionService):
 *   argv[1] pdf path, argv[2] output json, argv[3] images dir.
 *
 * Images are written straight to the images dir as real files and the JSON
 * only carries absolute file references – the multi-hundred-MB base64 blob
 * never exists in memory or on disk.
 *
 * SECURITY: the accelerator is pinned to CPU. GPU/CUDA execution was removed
 * from this build (c10_cuda.dll failures); no environment variable can
 * re-enable it.
 */

/** Tokens embedded in the script; the service uses them to detect stale copies. */
export const CONVERTER_SCRIPT_TOKENS = [
  'DOCLING_DO_OCR',
  'ASSET_EXPORT',
  'ACCELERATOR_CPU'
] as const

export async function ensureConverterScript(layout: DoclingDirLayout): Promise<string> {
  const scriptPath = getConverterScriptPath(layout)
  try {
    await fs.access(scriptPath)
    const stat = await fs.lstat(scriptPath)
    if (stat.isSymbolicLink()) {
      await fs.rm(scriptPath, { force: true })
      throw new Error('Symlink detected')
    }
    const existing = await fs.readFile(scriptPath, 'utf8').catch(() => '')
    if (CONVERTER_SCRIPT_TOKENS.every((token) => existing.includes(token))) return scriptPath
    await fs.rm(scriptPath, { force: true }).catch(() => {})
    throw new Error('Stale converter script – regenerating')
  } catch {
    // fall through to generation
  }
  await fs.mkdir(path.dirname(scriptPath), { recursive: true })

  const script = `
import os, sys, json, base64, pathlib
from pathlib import Path

pdf_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
images_dir = Path(sys.argv[3])

if not pdf_path.is_file():
    print(f"PDF not found: {pdf_path}", file=sys.stderr)
    sys.exit(2)
if pdf_path.suffix.lower() != ".pdf":
    print(f"Not a PDF: {pdf_path}", file=sys.stderr)
    sys.exit(3)

def _make_converter(do_ocr_override=None):
    # Full pipeline prefs from Settings – defaults match doclingPipelineSettings.ts
    # do_ocr_override allows the OCR retry path to reuse the exact same pipeline
    # construction (CPU, threads, timeouts, enrichment, etc.) with only OCR toggled.
    def _b(name): return os.environ.get(name) == "1"
    def _f(name, d):
        try: return float(os.environ.get(name, str(d)))
        except: return d
    def _i(name, d):
        try: return int(float(os.environ.get(name, str(d))))
        except: return d
    do_ocr = do_ocr_override if do_ocr_override is not None else _b("DOCLING_DO_OCR")
    ocr_lang = os.environ.get("DOCLING_OCR_LANG", "").strip()
    force_full_page_ocr = _b("DOCLING_FORCE_FULL_PAGE_OCR")
    detect_tables = _b("DOCLING_DETECT_TABLES")
    fast_tables = _b("DOCLING_FAST_TABLES")
    cell_matching = _b("DOCLING_CELL_MATCHING")
    do_code = _b("DOCLING_DO_CODE_ENRICHMENT")
    do_formula = _b("DOCLING_DO_FORMULA_ENRICHMENT")
    do_pic_class = _b("DOCLING_DO_PICTURE_CLASSIFICATION")
    do_pic_desc = _b("DOCLING_DO_PICTURE_DESCRIPTION")
    extract_figs = _b("DOCLING_EXTRACT_FIGURES")
    gen_page_imgs = _b("DOCLING_GENERATE_PAGE_IMAGES")
    gen_table_imgs = _b("DOCLING_GENERATE_TABLE_IMAGES")
    images_scale = _f("DOCLING_IMAGES_SCALE", 1.0)
    do_chart = _b("DOCLING_DO_CHART_EXTRACTION")
    force_backend_text = _b("DOCLING_FORCE_BACKEND_TEXT")
    enable_remote = _b("DOCLING_ENABLE_REMOTE_SERVICES")
    allow_plugins = _b("DOCLING_ALLOW_EXTERNAL_PLUGINS")
    doc_timeout = _f("DOCLING_DOCUMENT_TIMEOUT", 0) or None
    num_threads = _i("DOCLING_NUM_THREADS", 4)
    enable_heading = _b("DOCLING_ENABLE_HEADING_HIERARCHY")
    ocr_bs = _i("DOCLING_OCR_BATCH_SIZE", 4)
    layout_bs = _i("DOCLING_LAYOUT_BATCH_SIZE", 4)
    table_bs = _i("DOCLING_TABLE_BATCH_SIZE", 4)
    queue_max = _i("DOCLING_QUEUE_MAX_SIZE", 100)
    try:
        from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode, TableStructureOptions
        from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
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
        # Accelerator – always CPU in this build (GPU removed; see module docs).
        try:
            # ACCELERATOR_CPU marker token (do not remove – used for staleness detection)
            kwargs["accelerator_options"] = AcceleratorOptions(device=AcceleratorDevice.CPU, num_threads=num_threads)
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
        print(f"Pipeline ocr={do_ocr} lang={ocr_lang} figs={extract_figs} tables={detect_tables} fast={fast_tables} scale={images_scale} thr={num_threads} dev=cpu", flush=True)
        return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)})
    except Exception as e:
        print(f"Pipeline opts failed: {e}", file=sys.stderr, flush=True)
        import traceback; traceback.print_exc(file=sys.stderr)
        # Do NOT fall back to bare DocumentConverter() which would auto-detect
        # GPU (AcceleratorDevice.AUTO) and lose all user settings. Use an
        # explicit safe CPU fallback or fail closed.
        try:
            from docling.datamodel.pipeline_options import PdfPipelineOptions as SafeOpts
            from docling.datamodel.accelerator_options import AcceleratorDevice as SafeDev, AcceleratorOptions as SafeAcc
            from docling.document_converter import DocumentConverter as SafeConv, PdfFormatOption as SafeFmt
            from docling.datamodel.base_models import InputFormat as SafeFmtType
            safe_kwargs = dict(
                do_ocr=do_ocr,
                do_table_structure=True,
                accelerator_options=SafeAcc(device=SafeDev.CPU, num_threads=4),
            )
            safe_pipeline = SafeOpts(**safe_kwargs)
            print("Using safe CPU fallback pipeline", flush=True)
            return SafeConv(format_options={SafeFmtType.PDF: SafeFmt(pipeline_options=safe_pipeline)})
        except Exception as e2:
            print(f"Safe CPU fallback also failed: {e2}", file=sys.stderr, flush=True)
            traceback.print_exc(file=sys.stderr)
            sys.exit(1)

def _ext_for(header):
    if "png" in header: return "png"
    if "jpeg" in header or "jpg" in header: return "jpg"
    if "webp" in header: return "webp"
    return "bin"

def _export_assets(data):
    # ASSET_EXPORT marker token (do not remove – used for staleness detection)
    # Replace inline base64 data URIs with references to files written under
    # images_dir so the exported JSON stays small regardless of image count.
    written = 0
    images_dir.mkdir(parents=True, exist_ok=True)
    pictures = data.get("pictures") if isinstance(data, dict) else None
    if isinstance(pictures, list):
        for idx, pic in enumerate(pictures):
            if not isinstance(pic, dict): continue
            img = pic.get("image")
            if not isinstance(img, dict): continue
            uri = img.get("uri")
            if not isinstance(uri, str) or not uri.startswith("data:image/"): continue
            try:
                header, b64 = uri.split(",", 1)
                raw = base64.b64decode(b64)
                name = f"asset-{idx}-{abs(hash(uri)) % 100000}.{_ext_for(header)}"
                (images_dir / name).write_bytes(raw)
                img["uri"] = str((images_dir / name).resolve())
                written += 1
            except Exception as e:
                print(f"asset export failed for picture {idx}: {e}", file=sys.stderr, flush=True)
                img["uri"] = None
    print(f"assets exported: {written}", flush=True)

try:
    converter = _make_converter()
    result = converter.convert(str(pdf_path))
    doc = result.document

    has_text = any(t.get("text", "").strip() for t in doc.export_to_dict().get("texts", []))
    # Scanned-PDF fallback. When the Node preflight already forced OCR ON,
    # this branch is skipped – that is the fast path that avoids a wasted
    # full first pass. This retry remains only as a safety net for PDFs where
    # the preflight under-estimated the need for OCR.
    if not has_text and os.environ.get("DOCLING_DO_OCR") != "1":
        print("No text found with OCR off – retrying with OCR (CPU, preserved pipeline)", flush=True)
        try:
            retry_converter = _make_converter(do_ocr_override=True)
            retry_result = retry_converter.convert(str(pdf_path))
            doc = retry_result.document
        except Exception as retry_e:
            print(f"OCR retry failed: {retry_e}", file=sys.stderr, flush=True)

    # Embedded mode guarantees picture data URIs are present for _export_assets
    try:
        from docling.datamodel.document import ImageRefMode
        data = doc.export_to_dict(image_mode=ImageRefMode.EMBEDDED)
    except Exception:
        try:
            data = doc.export_to_dict(image_mode="embedded")
        except Exception:
            data = doc.export_to_dict()
    _export_assets(data)
except Exception as e:
    msg = str(e).lower()
    if "password" in msg or "encrypted" in msg:
        print(f"encrypted PDF: {e}", file=sys.stderr)
        sys.exit(10)
    if "corrupt" in msg or "damaged" in msg:
        print(f"corrupted PDF: {e}", file=sys.stderr)
        sys.exit(11)
    print(f"conversion failed: {e}", file=sys.stderr)
    import traceback; traceback.print_exc(file=sys.stderr)
    sys.exit(1)

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

print(f"converted {pdf_path} -> {out_path}")
`.trimStart()
  await fs.writeFile(scriptPath, script, 'utf8')
  await fs.chmod(scriptPath, 0o600).catch(() => {})
  return scriptPath
}

export function getConverterScriptPath(layout: DoclingDirLayout): string {
  return path.join(layout.root, 'service', 'convert_docling.py')
}
