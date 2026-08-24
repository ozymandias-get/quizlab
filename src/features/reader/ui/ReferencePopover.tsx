import { useEffect, useRef, useState } from 'react'

interface FootnotePopoverProps {
  refNumber: string
  token: string
}

export function FootnotePopover({ refNumber, token }: FootnotePopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const scrollToFootnote = () => {
    // Try to find footnote definition with matching number
    const candidates = [...document.querySelectorAll<HTMLElement>('[id^="footnote-"]')]
    // Also try generic search for text containing [n]
    let target = candidates.find((el) => el.textContent?.includes(`[${refNumber}]`))
    if (!target) {
      // Fallback: search all blocks for data-block-id with footnote-like text
      target = [...document.querySelectorAll<HTMLElement>('[data-block-id]')].find((el) =>
        el.textContent?.trim().startsWith(`[${refNumber}]`)
      ) as HTMLElement | undefined
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.classList.add('ring-2', 'ring-amber-400')
      setTimeout(() => target!.classList.remove('ring-2', 'ring-amber-400'), 1200)
    }
    setOpen(false)
  }

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-primary hover:text-primary/80 mx-0.5 inline-flex items-center rounded bg-amber-100 px-1 py-0.5 align-super text-[0.85em] leading-none font-medium hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60"
        aria-label={`Dipnot ${refNumber} önizleme`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {token}
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={`Dipnot ${refNumber}`}
          className="border-border bg-popover text-popover-foreground animate-in fade-in absolute left-1/2 z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border p-3 shadow-lg"
          style={{ top: '100%' }}
        >
          <span className="text-ql-12 font-semibold">Dipnot [{refNumber}]</span>
          <span className="text-muted-foreground text-ql-11 mt-1 block leading-5">
            Bu referansın detayına gitmeden yerinde önizleme. Docling tarafından etiketlenen
            referans sayfa sonuna zıplamak yerine burada gösterilir.
          </span>
          <span className="text-ql-11 text-muted-foreground/70 mt-2 block font-mono">
            Kaynak: sayfa sonu dipnotu
          </span>
          <span className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={scrollToFootnote}
              className="bg-primary text-primary-foreground text-ql-11 rounded-md px-2 py-1"
            >
              Dipnota git
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border bg-card text-ql-11 rounded-md border px-2 py-1"
            >
              Kapat
            </button>
          </span>
        </span>
      )}
    </span>
  )
}

interface ReferenceLinkProps {
  label: string
  rawToken: string
}

export function ReferenceLink({ label, rawToken }: ReferenceLinkProps) {
  const scrollToTarget = () => {
    const numMatch = label.match(/\d+/)
    const num = numMatch ? numMatch[0] : ''
    const isTable = /Tablo/i.test(label)
    // Try data attributes first
    let selector = isTable ? `[data-table-number="${num}"]` : `[data-figure-number="${num}"]`
    let target = document.querySelector(selector) as HTMLElement | null
    if (!target) {
      // Fallback: search for caption containing label
      const allBlocks = [...document.querySelectorAll<HTMLElement>('[data-block-id]')]
      target =
        allBlocks.find((el) => {
          const txt = el.textContent ?? ''
          return txt.includes(label) || txt.includes(`Şekil ${num}`) || txt.includes(`Table ${num}`)
        }) ?? null
    }
    if (target) {
      // If target is figure's inner element, scroll its block wrapper
      const blockWrapper = target.closest('[data-block-id]') as HTMLElement | null
      const el = blockWrapper ?? target
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-primary/40')
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40'), 1200)
    } else {
      // No target found – provide feedback
      const ev = new CustomEvent('quizlab:reference-not-found', { detail: { label } })
      window.dispatchEvent(ev)
    }
  }

  return (
    <button
      type="button"
      onClick={scrollToTarget}
      className="text-primary hover:text-primary/80 mx-0.5 inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[0.95em] font-medium underline decoration-dotted underline-offset-2 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
      aria-label={`${label} çapraz referansına git`}
      title={`${label} bloğuna odaklan`}
    >
      {rawToken}
      <span aria-hidden className="text-[0.8em]">
        ↗
      </span>
    </button>
  )
}
