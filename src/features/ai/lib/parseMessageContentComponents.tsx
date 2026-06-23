import { useToastActions } from '@app/providers'

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { showError } = useToastActions()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      showError('toast_clipboard_failed')
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-white/8 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-1.5">
        <span className="text-ql-11 font-mono text-white/40">{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-ql-11 rounded px-2 py-0.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
        >
          Copy
        </button>
      </div>
      <pre className="text-ql-13 overflow-x-auto p-3 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-white/8">
      <table className="text-ql-12 w-full">
        <thead>
          <tr className="border-b border-white/8 bg-white/[0.03]">
            {headers.map((h, i) => (
              <th
                // Static headers — items never reorder
                // eslint-disable-next-line react/no-array-index-key -- Static code snippet elements, no stable ids
                key={i}
                className="px-3 py-2 text-left font-medium whitespace-nowrap text-white/60"
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
            <tr key={ri} className="border-b border-white/[0.04] last:border-0">
              {row.map((cell, ci) => (
                // Table cells have no stable id — index is safe for static markdown rendering
                // eslint-disable-next-line react/no-array-index-key -- Static code elements, stable order
                <td key={ci} className="px-3 py-1.5 whitespace-nowrap text-white/70">
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

export default CodeBlock
