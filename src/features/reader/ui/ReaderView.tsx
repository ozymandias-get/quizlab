import type { QuizLabBlock, QuizLabDocument } from '@shared-core/types'

import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBlockVirtualization } from '../hooks/useBlockVirtualization'
import { useReaderCustomization } from '../hooks/useReaderCustomization'
import { useReaderRovingFocus } from '../hooks/useReaderRovingFocus'
import { BlockRenderer } from './ReaderBlocks'

function useReaderSearch(blocks: QuizLabDocument['blocks'], query: string) {
  const needle = query.trim().toLowerCase()
  return useMemo(() => {
    if (!needle) return { ids: new Set<string>(), count: 0 }
    const ids = new Set<string>()
    for (const b of blocks) {
      const text =
        (b as { text?: string }).text ??
        (b as { rawText?: string }).rawText ??
        (b as { rows?: { text: string }[][] }).rows
          ?.flat()
          .map((c) => c.text)
          .join(' ') ??
        ''
      if (text.toLowerCase().includes(needle)) ids.add(b.id)
    }
    return { ids, count: ids.size }
  }, [blocks, needle])
}

interface Props {
  document: QuizLabDocument
  onReprocess?: () => void
  onSwitchToPdf?: () => void
}

const ReaderView = memo(function ReaderView({ document, onReprocess, onSwitchToPdf }: Props) {
  const { t } = useTranslation()
  const meta = document.metadata as unknown as {
    partial?: boolean
    partialReason?: string
    degradedPipeline?: boolean
    degradedReason?: string
  }
  const isPartial = !!meta?.partial
  const isDegraded = !!meta?.degradedPipeline
  const [query, setQuery] = useState('')
  const [tocOpen, setTocOpen] = useState(false)
  const [currentMatch, setCurrentMatch] = useState(0)
  const { ids: matchedIds, count: matchCount } = useReaderSearch(document.blocks, query)
  const headings = useMemo(
    () =>
      document.blocks.filter((b) => b.type === 'heading') as Extract<
        QuizLabBlock,
        { type: 'heading' }
      >[],
    [document.blocks]
  )
  // Virtualization & memory scaling: @tanstack/react-virtual / IntersectionObserver tabanlı windowing
  const { isVirtualized, virtualWindow, containerRef } = useBlockVirtualization(
    document.blocks.length,
    true
  )
  // Reader typography & theme customization
  const { readerThemeClass, readerStyle } = useReaderCustomization()

  // Roving focus for a11y keyboard navigation
  const { containerProps: rovingContainerProps, registerBlockRef } = useReaderRovingFocus(
    document.blocks.map((b) => b.id)
  )

  const jumpToBlock = useCallback(
    (id: string): void => {
      // Virtualized modda hedef blok henüz render edilmemiş olabilir – önce window'u genişletmeye çalış
      const idx = document.blocks.findIndex((b) => b.id === id)
      if (isVirtualized && virtualWindow && idx !== -1) {
        const isOutside = idx < virtualWindow.startIndex || idx >= virtualWindow.endIndex
        if (isOutside) {
          // Hedefi viewport'a getirmek için window scroll'u atla ve DOM'un belirmesini bekle
          const estHeight = 140
          const container = containerRef.current
          if (container) {
            const containerTop = container.getBoundingClientRect().top + window.scrollY
            window.scrollTo({
              top: containerTop + idx * estHeight - window.innerHeight / 2,
              behavior: 'auto'
            })
            // Bir sonraki tick'te gerçek scrollIntoView çalışsın
            setTimeout(() => {
              const doc = typeof window !== 'undefined' ? window.document : null
              const el = doc?.getElementById(`block-${id}`)
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              if (el) {
                el.classList.add('ring-2', 'ring-primary/40')
                setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40'), 1200)
              }
            }, 80)
            return
          }
        }
      }
      const doc = typeof window !== 'undefined' ? window.document : null
      doc?.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const el = doc?.getElementById(`block-${id}`)
      if (el) {
        el.classList.add('ring-2', 'ring-primary/40')
        setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40'), 1200)
      }
    },
    [document.blocks, isVirtualized, virtualWindow, containerRef]
  )
  const nextMatch = (): void => {
    if (matchedIds.size === 0) return
    const ids = [...matchedIds]
    const next = (currentMatch + 1) % ids.length
    setCurrentMatch(next)
    jumpToBlock(ids[next]!)
  }
  const prevMatch = (): void => {
    if (matchedIds.size === 0) return
    const ids = [...matchedIds]
    const prev = (currentMatch - 1 + ids.length) % ids.length
    setCurrentMatch(prev)
    jumpToBlock(ids[prev]!)
  }

  // Sanallaştırma için render edilecek blok indeksi aralığı
  const visibleBlocks = useMemo(() => {
    if (!isVirtualized || !virtualWindow) return document.blocks
    return document.blocks.slice(virtualWindow.startIndex, virtualWindow.endIndex)
  }, [document.blocks, isVirtualized, virtualWindow])

  return (
    <article
      className={`mx-auto px-6 py-8 select-text md:px-8 ${readerThemeClass}`}
      style={{
        maxWidth: readerStyle.maxWidth,
        fontFamily: readerStyle.fontFamily,
        lineHeight: String(readerStyle.lineHeight),
        letterSpacing: readerStyle.letterSpacing,
        ...(readerStyle as unknown as Record<string, string>)
      }}
      aria-label={document.title ?? t('reader_smart_reading', { defaultValue: 'Akıllı okuma' })}
      role="document"
      tabIndex={0}
      onKeyDown={rovingContainerProps.onKeyDown}
    >
      <div className="border-border/40 bg-card/30 mb-6 flex flex-wrap items-center gap-2 rounded-xl border p-2.5 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCurrentMatch(0)
            }}
            placeholder={t('reader_search_placeholder', { defaultValue: 'Reader içinde ara…' })}
            className="border-border bg-card text-ql-13 min-w-0 flex-1 rounded-lg border px-3 py-1.5"
            aria-label={t('reader_search', { defaultValue: 'Ara' })}
          />
          {query && (
            <>
              <span className="text-ql-11 text-muted-foreground whitespace-nowrap">
                {matchCount > 0
                  ? `${currentMatch + 1}/${matchCount}`
                  : t('reader_no_match', { defaultValue: 'Eşleşme yok' })}
              </span>
              <button
                type="button"
                onClick={prevMatch}
                disabled={matchCount === 0}
                className="border-border bg-card text-ql-11 rounded-md border px-2 py-1 disabled:opacity-40"
                aria-label="Önceki eşleşme"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={nextMatch}
                disabled={matchCount === 0}
                className="border-border bg-card text-ql-11 rounded-md border px-2 py-1 disabled:opacity-40"
                aria-label="Sonraki eşleşme"
              >
                ↓
              </button>
            </>
          )}
        </div>
        {headings.length > 0 && (
          <button
            type="button"
            onClick={() => setTocOpen((v) => !v)}
            className="border-border bg-card text-ql-12 shrink-0 rounded-lg border px-3 py-1.5"
            aria-expanded={tocOpen}
            aria-controls="reader-toc"
          >
            {t('reader_toc', { defaultValue: 'İçindekiler' })} ({headings.length})
          </button>
        )}
      </div>
      {tocOpen && headings.length > 0 && (
        <nav
          id="reader-toc"
          aria-label={t('reader_toc', { defaultValue: 'İçindekiler' })}
          className="border-border bg-card/60 mb-6 max-h-64 overflow-auto rounded-xl border p-3"
        >
          <ul className="space-y-1">
            {headings.map((h) => (
              <li key={h.id} style={{ paddingLeft: `${Math.max(0, (h.level - 1) * 12)}px` }}>
                <button
                  type="button"
                  onClick={() => {
                    jumpToBlock(h.id)
                    setTocOpen(false)
                  }}
                  className="text-ql-13 text-foreground/80 hover:text-foreground hover:bg-muted/40 w-full truncate rounded-md px-2 py-1 text-left"
                  title={h.text}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {isPartial && (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 text-destructive mb-6 rounded-xl border p-4"
        >
          <p className="text-ql-13 font-semibold">
            {t('reader_partial_warning_title', {
              defaultValue: 'Belgenin tamamı dönüştürülemedi.'
            })}
          </p>
          <p className="text-ql-12 mt-1">
            {t('reader_partial_warning_desc', {
              defaultValue: 'Bazı sayfalar zaman aşımı nedeniyle eksik olabilir.'
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onSwitchToPdf && (
              <button
                type="button"
                onClick={onSwitchToPdf}
                className="border-destructive/30 bg-card text-ql-12 rounded-lg border px-3 py-1.5"
              >
                {t('reader_partial_action_pdf', { defaultValue: "PDF'ye geç" })}
              </button>
            )}
            {onReprocess && (
              <button
                type="button"
                onClick={onReprocess}
                className="bg-destructive text-destructive-foreground text-ql-12 rounded-lg px-3 py-1.5"
              >
                {t('reader_partial_action_reprocess', { defaultValue: 'Yeniden işle' })}
              </button>
            )}
          </div>
        </div>
      )}
      {isDegraded && !isPartial && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200"
        >
          <p className="text-ql-12">
            {t('reader_degraded_warning', {
              defaultValue: 'Bazı gelişmiş analiz özellikleri kullanılamadı.'
            })}
          </p>
        </div>
      )}
      {(document.title || onReprocess) && (
        <header className="border-border/50 bg-card/40 mb-8 rounded-2xl border p-5 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {document.title ? (
                <h1 className="text-foreground text-[1.45rem] leading-7 font-bold tracking-tight">
                  {document.title}
                </h1>
              ) : (
                <p className="text-muted-foreground text-ql-13">
                  {t('reader_untitled', { defaultValue: 'Başlıksız belge' })}
                </p>
              )}
              <p className="text-muted-foreground/70 text-ql-11 mt-1.5 flex flex-wrap items-center gap-2 font-mono">
                <span>
                  {t('reader_page_count', {
                    count: document.pageCount,
                    defaultValue: '{{count}} sayfa'
                  })}
                </span>
                <span className="bg-border h-1 w-1 rounded-full" aria-hidden />
                <span>
                  {t('reader_block_count', {
                    count: document.blocks.length,
                    defaultValue: '{{count}} blok'
                  })}
                </span>
                {document.metadata?.conversionTimeMs != null && (
                  <>
                    <span className="bg-border h-1 w-1 rounded-full" aria-hidden />
                    <span>{(document.metadata.conversionTimeMs / 1000).toFixed(1)}s</span>
                  </>
                )}
              </p>
            </div>
            {onReprocess && (
              <button
                type="button"
                onClick={onReprocess}
                className="text-ql-11 border-border bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card shrink-0 rounded-full border px-3 py-1.5 backdrop-blur transition-colors"
                aria-label={t('reader_reprocess_aria', { defaultValue: 'Belgeyi yeniden işle' })}
              >
                {t('reader_reprocess', { defaultValue: 'Yeniden işle' })}
              </button>
            )}
          </div>
        </header>
      )}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="space-y-1"
        role="feed"
        aria-busy={false}
        aria-label={t('reader_blocks_feed', { defaultValue: 'Doküman blokları' })}
      >
        {isVirtualized && virtualWindow ? (
          <>
            <div style={{ height: virtualWindow.offsetY }} aria-hidden />
            {visibleBlocks.map((block) => {
              const isMatch = matchedIds.has(block.id)
              return (
                <div
                  key={block.id}
                  id={`block-${block.id}`}
                  ref={(el) => registerBlockRef(block.id, el as HTMLElement | null)}
                  tabIndex={-1}
                  role="article"
                  aria-posinset={block.readingOrder + 1}
                  aria-setsize={document.blocks.length}
                  className={
                    isMatch ? 'rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20' : undefined
                  }
                  style={
                    {
                      contentVisibility: 'auto',
                      containIntrinsicSize: '0 500px'
                    } as React.CSSProperties
                  }
                >
                  <BlockRenderer block={block} documentId={document.id} />
                </div>
              )
            })}
            <div
              style={{
                height: Math.max(
                  0,
                  virtualWindow.totalHeight - virtualWindow.offsetY - visibleBlocks.length * 140
                )
              }}
              aria-hidden
            />
            <div className="text-muted-foreground/50 text-ql-11 py-2 text-center font-mono">
              Sanallaştırılmış görünüm: {virtualWindow.startIndex + 1}–
              {virtualWindow.startIndex + visibleBlocks.length} / {document.blocks.length} blok
              (Intersection Observer windowing)
            </div>
          </>
        ) : (
          document.blocks.map((block) => {
            const isMatch = matchedIds.has(block.id)
            return (
              <div
                key={block.id}
                id={`block-${block.id}`}
                ref={(el) => registerBlockRef(block.id, el as HTMLElement | null)}
                tabIndex={-1}
                role="article"
                aria-posinset={block.readingOrder + 1}
                aria-setsize={document.blocks.length}
                className={
                  isMatch ? 'rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20' : undefined
                }
              >
                <BlockRenderer block={block} documentId={document.id} />
              </div>
            )
          })
        )}
      </div>
      {document.blocks.length === 0 && (
        <p className="text-muted-foreground text-ql-13 py-12 text-center">
          {t('reader_no_content', { defaultValue: 'İçerik bulunamadı' })}
        </p>
      )}
    </article>
  )
})

export default ReaderView
