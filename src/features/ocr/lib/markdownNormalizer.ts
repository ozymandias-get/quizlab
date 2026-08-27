/**
 * Markdown normalization layer — converts raw OCR / text-layer output into
 * structured Markdown while preserving academic/medical symbols.
 */
import type { OcrBlock, OcrFormula, OcrTable } from '../types'

const TURKISH_CHAR_MAP: Record<string, string> = {
  İ: 'İ',
  ı: 'ı',
  Ş: 'Ş',
  ş: 'ş',
  Ğ: 'Ğ',
  ğ: 'ğ',
  Ü: 'Ü',
  ü: 'ü',
  Ö: 'Ö',
  ö: 'ö',
  Ç: 'Ç',
  ç: 'ç'
}

/**
 * Preserve medical/academic superscripts & special chars — never strip them.
 * Examples: HbA1c, Na+, K+, Ca2+, CD4+, IL-6, TNF-α, β-blocker, H₂O, CO₂
 */
function preserveScientificSymbols(text: string): string {
  return text
}

function normalizeWhitespace(text: string): string {
  return text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\u00A0', ' ')
    .replaceAll(/[ \t]+/g, ' ')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}

function fixHyphenation(text: string): string {
  // De-hyphenate words split across lines: "sağ-\nlık" -> "sağlık"
  // Use Unicode letter class so Turkish characters are not broken.
  // Only merge when the next line starts with lowercase letter to avoid headings.
  return text.replaceAll(/(\p{L})-\n(\p{L})/gu, (_m, a: string, b: string) => {
    if (/^\p{Ll}/u.test(b)) return `${a}${b}`
    return `${a}-\n${b}`
  })
}

function detectHeading(line: string): { level: number; text: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  // Explicit Markdown heading already starts with # — handled earlier, but keep for plain text
  if (/^#{1,6}\s+/.test(trimmed)) {
    const m = trimmed.match(/^(#{1,6})\s+(.+)/)
    if (m) return { level: m[1]?.length ?? 1, text: m[2] ?? trimmed }
  }
  // All-caps short lines are likely headings (avoid matching long paragraphs)
  if (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-ZÇĞİÖŞÜ]{3,}/.test(trimmed)) {
    return { level: 2, text: trimmed }
  }
  // Numbered headings like "1 Introduction" or "1.2.3 Methods" — but NOT simple ordered list items
  // Distinguish: single "1. Aspirin" is a list, "1.2 Title" is a heading.
  const numbered = trimmed.match(/^(\d+(?:\.\d+)*)\.?\s+(.+)/)
  if (numbered && trimmed.length < 120) {
    const depth = (numbered[1] ?? '').split('.').filter(Boolean).length
    const rest = numbered[2] ?? ''
    // Depth >1 (e.g., 1.2) definitely heading; depth 1 with longer phrase and capitalized may be heading but list takes precedence
    if (depth > 1) {
      return { level: Math.min(3, depth) as number, text: trimmed }
    }
    // Depth 1 heuristic: if rest is very short single word (like list item), let isListItem handle it — return null here
    // Otherwise treat as heading only if rest length > 12 or looks like title case
    if (rest.length > 12 || /^[A-ZÇĞİÖŞÜ]/.test(rest.trim())) {
      // Caller must ensure list check ran first — this path only reached if list check said no
      return { level: 2, text: trimmed }
    }
  }
  return null
}

function isListItem(line: string): boolean {
  const trimmed = line.trim()
  // Ordered list: single number + delimiter (1. item) — not section headings like 1.2.3
  // Negative: if numbered section depth >1, not a list
  if (/^\s*\d+(?:\.\d+)+\s+/.test(trimmed)) return false
  return /^\s*(?:[-•*]\s+|\d+[.)]\s+)/.test(line)
}

function normalizeListItem(line: string): string {
  const trimmed = line.trim()
  const bullet = trimmed.match(/^[•*]\s+(.+)/)
  if (bullet) return `- ${bullet[1]}`
  const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)/)
  if (numbered) return `${numbered[1]}. ${numbered[2]}`
  return trimmed
}

function escapeMarkdown(text: string): string {
  return text
}

export function normalizeToMarkdown(raw: string): {
  markdown: string
  plainText: string
  blocks: OcrBlock[]
  tables: OcrTable[]
  formulas: OcrFormula[]
} {
  let text = preserveScientificSymbols(raw)
  text = fixHyphenation(text)
  text = normalizeWhitespace(text)

  const plainText = text

  const lines = text.split('\n').map((l) => l.trimEnd())
  const blocks: OcrBlock[] = []
  const tables: OcrTable[] = []
  const formulas: OcrFormula[] = []
  const markdownLines: string[] = []

  let paragraphBuffer: string[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let codeLang = ''

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return
    const para = paragraphBuffer.join(' ').trim()
    paragraphBuffer = []
    if (!para) return

    if (para.includes('$$')) {
      formulas.push({ latex: para, display: true, raw: para })
      blocks.push({ text: para, kind: 'formula' })
      markdownLines.push(para)
      return
    }
    if (/\$[^$]+\$/.test(para)) {
      blocks.push({ text: para, kind: 'paragraph' })
      markdownLines.push(para)
      return
    }

    // Priority: explicit heading -> list -> numbered heading heuristic -> paragraph
    // Check explicit markdown heading first
    if (/^#{1,6}\s+/.test(para)) {
      const heading = detectHeading(para)
      if (heading) {
        const hashes = '#'.repeat(heading.level)
        blocks.push({ text: heading.text, kind: 'heading' })
        markdownLines.push(`${hashes} ${escapeMarkdown(heading.text)}`)
        return
      }
    }

    if (isListItem(para)) {
      blocks.push({ text: para, kind: 'list-item' })
      markdownLines.push(normalizeListItem(para))
      return
    }

    const heading = detectHeading(para)
    if (heading) {
      const hashes = '#'.repeat(heading.level)
      blocks.push({ text: heading.text, kind: 'heading' })
      markdownLines.push(`${hashes} ${escapeMarkdown(heading.text)}`)
      return
    }

    blocks.push({ text: para, kind: 'paragraph' })
    markdownLines.push(escapeMarkdown(para))
    markdownLines.push('')
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inCodeBlock) {
        codeBuffer.push('')
      } else {
        flushParagraph()
      }
      continue
    }

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ text: codeBuffer.join('\n'), kind: 'code' })
        markdownLines.push(`\`\`\`${codeLang}`)
        markdownLines.push(...codeBuffer)
        markdownLines.push('```')
        markdownLines.push('')
        codeBuffer = []
        inCodeBlock = false
        codeLang = ''
      } else {
        flushParagraph()
        inCodeBlock = true
        codeLang = trimmed.slice(3).trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
      flushParagraph()
      blocks.push({ text: trimmed, kind: 'table' })
      markdownLines.push(trimmed)
      continue
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph()
      markdownLines.push('---')
      markdownLines.push('')
      continue
    }

    if (trimmed.startsWith('>')) {
      flushParagraph()
      blocks.push({ text: trimmed, kind: 'paragraph' })
      markdownLines.push(trimmed)
      markdownLines.push('')
      continue
    }

    // Explicit markdown heading syntax — highest priority (e.g., "# Title")
    if (/^#{1,6}\s+/.test(trimmed)) {
      flushParagraph()
      const headingCandidate = detectHeading(trimmed)
      if (headingCandidate) {
        const hashes = '#'.repeat(headingCandidate.level)
        blocks.push({ text: headingCandidate.text, kind: 'heading' })
        markdownLines.push(`${hashes} ${escapeMarkdown(headingCandidate.text)}`)
        continue
      }
    }

    // List item — each bullet/numbered line is its own block, not merged with paragraph
    // Check list BEFORE numbered heading heuristic (audit priority)
    if (isListItem(trimmed)) {
      flushParagraph()
      const normalized = normalizeListItem(trimmed)
      blocks.push({ text: normalized, kind: 'list-item' })
      markdownLines.push(normalized)
      continue
    }

    // Numbered section heading heuristic — after list
    const headingCandidate = detectHeading(trimmed)
    if (headingCandidate) {
      flushParagraph()
      const hashes = '#'.repeat(headingCandidate.level)
      blocks.push({ text: headingCandidate.text, kind: 'heading' })
      markdownLines.push(`${hashes} ${escapeMarkdown(headingCandidate.text)}`)
      continue
    }

    paragraphBuffer.push(trimmed)
  }

  flushParagraph()
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({ text: codeBuffer.join('\n'), kind: 'code' })
    markdownLines.push(`\`\`\`${codeLang}`)
    markdownLines.push(...codeBuffer)
    markdownLines.push('```')
  }

  const markdown = markdownLines
    .join('\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
    .split('\n')
    .map((l) => {
      for (const ch of Object.keys(TURKISH_CHAR_MAP)) {
        void ch
      }
      return l
    })
    .join('\n')

  const tableRegex = /^\|(.+)\|\n\|[-| :]+\|\n((?:\|.*\|\n?)*)/gm
  let m: RegExpExecArray | null

  while ((m = tableRegex.exec(markdown)) !== null) {
    const headerLine = m[1] ?? ''
    const body = m[2] ?? ''
    const headers = headerLine
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
    const rows = body
      .trim()
      .split('\n')
      .map((row) =>
        row
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      )
      .filter((r) => r.length > 0)
    if (headers.length > 0) {
      tables.push({ headers, rows })
    }
  }

  const inlineFormulaRegex = /\$([^$]+)\$/g
  let fm: RegExpExecArray | null

  while ((fm = inlineFormulaRegex.exec(markdown)) !== null) {
    formulas.push({ latex: fm[1] ?? '', display: false, raw: fm[0] ?? '' })
  }
  const displayFormulaRegex = /\$\$([\s\S]+?)\$\$/g
  let dfm: RegExpExecArray | null

  while ((dfm = displayFormulaRegex.exec(markdown)) !== null) {
    const exists = formulas.some((f) => f.raw === dfm?.[0])
    if (!exists) formulas.push({ latex: dfm?.[1] ?? '', display: true, raw: dfm?.[0] ?? '' })
  }

  return { markdown: markdown || plainText, plainText, blocks, tables, formulas }
}

export function convertLatexToMarkdownSafe(text: string): string {
  return text.replaceAll(/\\\[(.*?)\\\]/g, '$$$$$1$$$$').replaceAll(/\\\((.*?)\\\)/g, '$$$1$$')
}
