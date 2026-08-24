import type { QuizLabBlock } from '@shared-core/types'

import { useReaderCustomization } from '@features/reader/hooks/useReaderCustomization'
import { useShowInPdf } from '@features/reader/hooks/useReaderPdfLink'

import {
  ExternalLink,
  Highlighter,
  MessageSquarePlus,
  Send,
  StickyNote,
  Trash2
} from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type HighlightColor, useReaderAnnotationStore } from '../store/readerAnnotationStore'

function blockToMarkdown(block: QuizLabBlock): string {
  switch (block.type) {
    case 'heading': {
      const lvl = (block as { level: number }).level ?? 1
      return `${'#'.repeat(Math.min(6, lvl))} ${(block as { text: string }).text}`
    }
    case 'paragraph':
    case 'list_item':
    case 'caption':
      return (block as { text: string }).text
    case 'code':
      return '```\n' + (block as { text: string }).text + '\n```'
    case 'formula':
      return `$$${(block as { text: string }).text}$$`
    case 'table': {
      const rows = (block as { rows: { text: string }[][] }).rows
      if (rows.length === 0) return ''
      const header = `| ${rows[0].map((c) => c.text || ' ').join(' | ')} |`
      const sep = `| ${rows[0].map(() => '---').join(' | ')} |`
      const body = rows.slice(1).map((r) => `| ${r.map((c) => c.text || ' ').join(' | ')} |`)
      return [header, sep, ...body].join('\n')
    }
    case 'image':
      return (block as { alt: string | null }).alt ?? `[image ${block.pageNumber}]`
    default:
      return (block as unknown as { text?: string }).text ?? ''
  }
}

export function PageBadge({ pageNumber }: { pageNumber: number }) {
  return (
    <span
      className="text-ql-11 text-muted-foreground/70 border-border/60 bg-muted/30 inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono backdrop-blur"
      title={`Sayfa ${pageNumber}`}
      aria-label={`Sayfa ${pageNumber}`}
    >
      {pageNumber}
    </span>
  )
}

/**
 * Reader tema paletleri – göz yorgunluğunu azaltan özel arka plan/kontrast
 * Sepya / Solarized / E-Ink / Yüksek Kontrast için kontrast ve arka plan
 * ReaderBlockShell seviyesinde uygulanır (ReaderView'deki themeVars ile uyumlu)
 */
export const READER_THEME_PALETTES = {
  default: 'bg-transparent text-foreground',
  sepia:
    'bg-[var(--reader-bg,#f4ecd8)] text-[var(--reader-fg,#5b4636)] border-[var(--reader-border)]',
  solarized: 'bg-[var(--reader-bg,#fdf6e3)] text-[var(--reader-fg,#657b83)]',
  eink: 'bg-white text-black contrast-125',
  highContrast: 'bg-black text-white border-white'
} as const

export const BlockWrapper = memo(function BlockWrapper({
  block,
  children,
  documentId
}: {
  block: QuizLabBlock
  children: React.ReactNode
  documentId?: string
}) {
  const showInPdf = useShowInPdf()
  const { t } = useTranslation()
  const { customization } = useReaderCustomization()
  // Annotation hooks – optional documentId fallback to block readingOrder context
  const docId = documentId ?? (block.metadata?.docId as string | undefined) ?? 'unknown-doc'
  const allHighlights = useReaderAnnotationStore((s) => s.highlights)
  const allNotes = useReaderAnnotationStore((s) => s.notes)
  const highlights = allHighlights.filter(
    (h) => h.blockId === block.id && (docId === 'unknown-doc' || h.documentId === docId)
  )
  const notes = allNotes.filter(
    (n) => n.blockId === block.id && (docId === 'unknown-doc' || n.documentId === docId)
  )
  const addHighlight = useReaderAnnotationStore((s) => s.addHighlight)
  const removeHighlight = useReaderAnnotationStore((s) => s.removeHighlight)
  const addNote = useReaderAnnotationStore((s) => s.addNote)
  const removeNote = useReaderAnnotationStore((s) => s.removeNote)
  const [noteDraft, setNoteDraft] = useState('')
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const hasHighlight = highlights.length > 0

  const highlightColorClass =
    highlights[0]?.color === 'yellow'
      ? 'bg-yellow-200/60 dark:bg-yellow-800/40'
      : highlights[0]?.color === 'green'
        ? 'bg-green-200/60 dark:bg-green-800/40'
        : highlights[0]?.color === 'blue'
          ? 'bg-blue-200/60 dark:bg-blue-800/40'
          : highlights[0]?.color === 'pink'
            ? 'bg-pink-200/60 dark:bg-pink-800/40'
            : highlights[0]?.color === 'orange'
              ? 'bg-orange-200/60 dark:bg-orange-800/40'
              : ''

  const handleHighlight = useCallback(
    (color: HighlightColor) => {
      addHighlight({ blockId: block.id, documentId: docId, color })
    },
    [addHighlight, block.id, docId]
  )

  const handleAddNote = useCallback(() => {
    const text = noteDraft.trim()
    if (!text) return
    addNote({ blockId: block.id, documentId: docId, text, pageNumber: block.pageNumber })
    setNoteDraft('')
    setIsNoteOpen(false)
  }, [addNote, block.id, block.pageNumber, docId, noteDraft])

  const sendToAi = useCallback(() => {
    const text = blockToMarkdown(block)
    if (!text.trim()) return
    // Dispatch a custom event that AiSendComposer listens to, or use the
    // global draft store if available. Fallback: copy to clipboard + toast.
    const evt = new CustomEvent('quizlab:send-block-to-ai', { detail: { text, blockId: block.id } })
    window.dispatchEvent(evt)
    // Fallback for web/electron: try to use the app-tool draft store if present
    try {
      const api = (window as unknown as { __quizlabAddDraft?: (t: string) => void })
        .__quizlabAddDraft
      if (api) api(text)
      else void navigator.clipboard.writeText(text).catch(() => {})
    } catch {}
  }, [block])
  const themeClass =
    customization.theme === 'sepia'
      ? READER_THEME_PALETTES.sepia
      : customization.theme === 'solarized'
        ? READER_THEME_PALETTES.solarized
        : customization.theme === 'eink'
          ? READER_THEME_PALETTES.eink
          : customization.theme === 'highContrast'
            ? READER_THEME_PALETTES.highContrast
            : READER_THEME_PALETTES.default

  return (
    <div
      data-block-id={block.id}
      data-page={block.pageNumber}
      className={`group/block scroll-mt-[var(--reader-paragraph-gap,0.75rem)] ${themeClass} ${hasHighlight ? `rounded-lg ${highlightColorClass} px-2 py-1` : ''}`}
      style={
        {
          contentVisibility: 'auto' as never,
          containIntrinsicSize: '0 600px',
          fontFamily:
            customization.fontFamily === 'serif'
              ? 'Georgia, serif'
              : customization.fontFamily === 'dyslexic'
                ? '"OpenDyslexic", sans-serif'
                : undefined,
          letterSpacing: customization.letterSpacing
        } as never
      }
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {children}
          {/* Margin Notes / Inline Comments – kalıcı açıklamalar köprüsü */}
          {notes.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-50 px-3 py-2 dark:bg-amber-950/30"
                >
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <p className="text-ql-12 text-foreground/90 min-w-0 flex-1 whitespace-pre-wrap">
                    {note.text}
                  </p>
                  <span className="text-muted-foreground text-ql-11 shrink-0 font-mono">
                    p.{note.pageNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNote(note.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 rounded p-1"
                    aria-label="Notu sil"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {isNoteOpen && (
            <div className="mt-2 flex gap-1.5">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={t('reader_add_note_placeholder', { defaultValue: 'Kenar notu ekle…' })}
                className="border-border bg-card text-ql-12 min-w-0 flex-1 rounded-lg border px-2.5 py-1.5"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddNote()
                  }
                  if (e.key === 'Escape') setIsNoteOpen(false)
                }}
              />
              <button
                type="button"
                onClick={handleAddNote}
                className="bg-primary text-primary-foreground text-ql-12 rounded-lg px-3 py-1.5"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => setIsNoteOpen(false)}
                className="border-border bg-card text-ql-12 rounded-lg border px-3 py-1.5"
              >
                İptal
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1">
          <PageBadge pageNumber={block.pageNumber} />
          {hasHighlight ? (
            <button
              type="button"
              onClick={() => highlights[0] && removeHighlight(highlights[0].id)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/30 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
              aria-label="Vurguyu kaldır"
              title="Vurguyu kaldır"
            >
              <Highlighter className="h-3 w-3" />
            </button>
          ) : (
            <div className="hidden items-center gap-0.5 group-hover/block:flex">
              {(['yellow', 'green', 'blue', 'pink'] as HighlightColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleHighlight(c)}
                  className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${c === 'yellow' ? 'border-yellow-500 bg-yellow-300' : c === 'green' ? 'border-green-500 bg-green-300' : c === 'blue' ? 'border-blue-500 bg-blue-300' : 'border-pink-500 bg-pink-300'}`}
                  aria-label={`Vurgula ${c}`}
                  title={`Vurgula ${c}`}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsNoteOpen((v) => !v)}
            className="border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border hidden h-6 w-6 items-center justify-center rounded-md border opacity-0 backdrop-blur transition-all group-hover/block:opacity-100 md:inline-flex"
            aria-label="Kenar notu ekle"
            title="Kenar notu ekle (margin note)"
          >
            <MessageSquarePlus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => showInPdf(block)}
            className="border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border hidden h-6 w-6 items-center justify-center rounded-md border opacity-0 backdrop-blur transition-all group-hover/block:opacity-100 md:inline-flex"
            aria-label={`PDF'de göster, sayfa ${block.pageNumber}`}
            title="PDF'de göster"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={sendToAi}
            className="border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card hover:border-border hidden h-6 w-6 items-center justify-center rounded-md border opacity-0 backdrop-blur transition-all group-hover/block:opacity-100 md:inline-flex"
            aria-label={t('reader_send_to_ai', { defaultValue: 'AI’a gönder' })}
            title={t('reader_send_to_ai', { defaultValue: 'AI’a gönder' })}
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="text-muted-foreground/60 text-ql-11 mt-1 flex items-center gap-1">
          <StickyNote className="h-3 w-3" />
          <span>
            {notes.length} not • PDF moduna geçildiğinde sayfa {block.pageNumber} koordinatında
            görüntülenir
          </span>
        </div>
      )}
    </div>
  )
})
