import { useClipboard } from '@shared/hooks/useClipboard'
import { Button } from '@shared/ui/components/primitives'

import { Check, Copy } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const CODE_COPY_CONFIRMATION_MS = 2000

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { t } = useTranslation()
  const { copy, isCopied } = useClipboard(CODE_COPY_CONFIRMATION_MS)

  const handleCopy = useCallback(() => void copy(code), [code, copy])

  return (
    // Container queries let the header collapse the label on a very narrow
    // message bubble without hiding the copy action itself.
    <div className="@container my-3 overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-950">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] bg-zinc-950/80 px-3 py-1.5">
        <span className="text-ql-11 min-w-0 truncate font-mono text-zinc-400 uppercase">
          {lang || 'code'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleCopy}
          aria-label={t('copy_code')}
          className={`text-ql-11 shrink-0 gap-1 rounded-md border border-white/[0.07] bg-white/[0.04] hover:bg-white/10 ${
            isCopied ? 'text-emerald-400' : 'text-zinc-300'
          }`}
        >
          {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
          <span className="@max-[360px]:hidden">{isCopied ? t('copied') : t('copy_code')}</span>
        </Button>
      </div>
      <pre className="custom-scrollbar text-ql-13 overflow-x-auto p-3 leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-white/[0.07] bg-zinc-950/80">
      <table className="text-ql-12 w-full">
        <thead>
          <tr className="border-b border-white/[0.07] bg-white/[0.04]">
            {headers.map((h, i) => (
              <th
                // Static headers — items never reorder
                // eslint-disable-next-line react/no-array-index-key -- Static code snippet elements, no stable ids
                key={i}
                className="px-3 py-2 text-left font-semibold whitespace-nowrap text-zinc-100"
              >
                {h.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            // Table rows have no stable id — index is safe for static markdown rendering
            // eslint-disable-next-line react/no-array-index-key -- Static aria label parts, stable order
            <tr key={ri} className="border-b border-white/5 last:border-0">
              {row.map((cell, ci) => (
                // Table cells have no stable id — index is safe for static markdown rendering
                // eslint-disable-next-line react/no-array-index-key -- Static code elements, stable order
                <td key={ci} className="px-3 py-1.5 whitespace-nowrap text-zinc-300">
                  {cell.trim()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
