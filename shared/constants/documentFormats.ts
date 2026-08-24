/**
 * Multi-format document ingestion – supported input types for Docling.
 * Docling engine supports PDF, DOCX, PPTX, HTML, Markdown and scanned image formats
 * via the same DocumentConverter pipeline with format-specific options.
 */

export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'html',
  'htm',
  'md',
  'markdown',
  'png',
  'jpg',
  'jpeg',
  'tiff',
  'tif',
  'bmp',
  'webp'
] as const

export type SupportedDocumentExtension = (typeof SUPPORTED_DOCUMENT_EXTENSIONS)[number]

export const DOCUMENT_FORMAT_FILTERS: Array<{ name: string; extensions: string[] }> = [
  { name: 'All Supported Documents', extensions: [...SUPPORTED_DOCUMENT_EXTENSIONS] },
  { name: 'PDF Documents', extensions: ['pdf'] },
  { name: 'Word Documents', extensions: ['docx'] },
  { name: 'PowerPoint Presentations', extensions: ['pptx'] },
  { name: 'HTML Documents', extensions: ['html', 'htm'] },
  { name: 'Markdown Documents', extensions: ['md', 'markdown'] },
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp'] }
]

/**
 * Map file extension to Docling InputFormat name (Python side).
 * Used by doclingConverterScript format router.
 */
export const EXTENSION_TO_DOCLING_FORMAT: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  pptx: 'PPTX',
  html: 'HTML',
  htm: 'HTML',
  md: 'MD',
  markdown: 'MD',
  png: 'IMAGE',
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  tiff: 'IMAGE',
  tif: 'IMAGE',
  bmp: 'IMAGE',
  webp: 'IMAGE'
}

export function getDocumentFormatForExtension(ext: string): string | null {
  const lower = ext.toLowerCase().replace(/^\./, '')
  return EXTENSION_TO_DOCLING_FORMAT[lower] ?? null
}

export function isSupportedDocumentExtension(ext: string): boolean {
  const lower = ext.toLowerCase().replace(/^\./, '')
  return (SUPPORTED_DOCUMENT_EXTENSIONS as readonly string[]).includes(lower)
}

export function isSupportedDocumentFileName(fileName: string): boolean {
  const ext = fileName.split('.').pop() ?? ''
  return isSupportedDocumentExtension(ext)
}

export function getFileExtension(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath
  const dotIndex = base.lastIndexOf('.')
  return dotIndex >= 0 ? base.slice(dotIndex + 1).toLowerCase() : ''
}
