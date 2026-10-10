/**
 * PDF kaynak metadata'sı — her taslak öğesinin hangi belgeden, hangi
 * sayfadan (veya sayfa aralığından) geldiğini ve belgenin toplam sayfa
 * sayısını taşır. Gönderim anındaki aktif sayfa değil, seçim/yakalama
 * anındaki gerçek sayfa kaydedilir.
 */

export type PdfCaptureKind = 'text-selection' | 'full-page-text' | 'full-page-image' | 'area-image'

export interface PdfSourceMeta {
  /** Kararlı belge kimliği: path + streamUrl + name + size birleşimi. */
  docId: string
  /** Kullanıcıya gösterilecek kısa belge adı (varsa). */
  docName?: string
  /** 1-based kaynak sayfa. */
  page: number
  /** Çok sayfalı seçimlerde bitiş sayfası (tek sayfada yok). */
  pageEnd?: number
  /** Biliniyorsa toplam sayfa sayısı. Bilinmiyorsa uydurma sayı yazılmaz. */
  totalPages?: number
  captureKind: PdfCaptureKind
  createdAt: number
}

export interface PdfFileIdentity {
  path?: string | null
  streamUrl?: string | null
  name?: string | null
  size?: number | null
}

export function buildPdfDocId(file: PdfFileIdentity | null | undefined): string {
  if (!file) return 'unknown-doc'
  const parts = [file.path ?? '', file.streamUrl ?? '', file.name ?? '', String(file.size ?? '')]
  const joined = parts.join('::')
  // Boş kimlikte stabil bir fallback üret; rastgele üretme (karşılaştırılabilir kalsın).
  if (!joined.replaceAll(':', '').trim()) return 'unknown-doc'
  return joined
}

export function buildPdfSourceMeta(input: {
  file?: PdfFileIdentity | null
  page: number
  pageEnd?: number
  totalPages?: number
  captureKind: PdfCaptureKind
  createdAt?: number
}): PdfSourceMeta {
  const page = Number.isFinite(input.page) && input.page >= 1 ? Math.floor(input.page) : 1
  let pageEnd: number | undefined
  if (input.pageEnd !== undefined && Number.isFinite(input.pageEnd)) {
    const end = Math.floor(input.pageEnd)
    if (end > page) pageEnd = end
  }
  let totalPages: number | undefined
  if (
    input.totalPages !== undefined &&
    Number.isFinite(input.totalPages) &&
    input.totalPages >= 1
  ) {
    totalPages = Math.floor(input.totalPages)
  }
  return {
    docId: buildPdfDocId(input.file),
    docName: input.file?.name ?? undefined,
    page,
    pageEnd,
    totalPages,
    captureKind: input.captureKind,
    createdAt: input.createdAt ?? Date.now()
  }
}

/**
 * "13/59", "11–13/59" veya toplam bilinmiyorsa "13" döner.
 * Uydurma toplam yazılmaz.
 */
export function formatSourcePages(source: PdfSourceMeta | null | undefined): string | null {
  if (!source || !Number.isFinite(source.page)) return null
  const start = Math.floor(source.page)
  const end = source.pageEnd && source.pageEnd > start ? Math.floor(source.pageEnd) : null
  const range = end ? `${start}–${end}` : `${start}`
  if (source.totalPages && source.totalPages >= 1) {
    return `${range}/${Math.floor(source.totalPages)}`
  }
  return range
}

/** "Sayfa 13/59" — UI satırları için. Toplam yoksa "Sayfa 13". */
export function formatSourcePageLabel(source: PdfSourceMeta | null | undefined): string | null {
  const pages = formatSourcePages(source)
  if (!pages) return null
  return `Sayfa ${pages}`
}

/** "[PDF Kaynağı — Metin — Sayfa 13/59]" — AI'ye giden kaynak başlığı. */
export function buildTextSourceHeader(source: PdfSourceMeta | null | undefined): string | null {
  const label = formatSourcePageLabel(source)
  if (!label) return null
  return `[PDF Kaynağı — Metin — ${label}]`
}

/** "[PDF Kaynağı — Görsel — Sayfa 13/59]" */
export function buildImageSourceHeader(source: PdfSourceMeta | null | undefined): string | null {
  const label = formatSourcePageLabel(source)
  if (!label) return null
  return `[PDF Kaynağı — Görsel — ${label}]`
}

/**
 * Metni kaynak başlığıyla süsle. Kaynak yoksa metni olduğu gibi döndür.
 * Kullanıcının prompt/notundan ayrı bir meta satırı olarak başa eklenir.
 */
export function decorateTextWithSource(
  text: string,
  source: PdfSourceMeta | null | undefined,
  kind: 'text' | 'image'
): string {
  const header = kind === 'text' ? buildTextSourceHeader(source) : buildImageSourceHeader(source)
  if (!header) return text
  if (!text) return header
  return `${header}\n${text}`
}

/** Eski `page` alanından yeni source'a geçiş için geriye uyumlu okuma. */
export function readItemPageLabel(opts: {
  source?: PdfSourceMeta | null
  legacyPage?: number | null
  legacyTotalPages?: number | null
}): string | null {
  if (opts.source) return formatSourcePageLabel(opts.source)
  if (opts.legacyPage && Number.isFinite(opts.legacyPage)) {
    if (opts.legacyTotalPages && opts.legacyTotalPages >= 1) {
      return `Sayfa ${Math.floor(opts.legacyPage)}/${Math.floor(opts.legacyTotalPages)}`
    }
    return `Sayfa ${Math.floor(opts.legacyPage)}`
  }
  return null
}
