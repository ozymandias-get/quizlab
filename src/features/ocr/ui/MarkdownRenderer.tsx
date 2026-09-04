import { cn } from '@shared/lib/uiUtils'

import { memo, useMemo } from 'react'

import { markdownToHtml } from '../lib/markdownToHtml'

interface MarkdownRendererProps {
  markdown: string
  className?: string
}

/**
 * Minimal safe Markdown renderer — avoids adding heavy dependencies (react-markdown + remark-gfm + katex)
 * to the main bundle. Covers: headings, bold, italic, lists, blockquote, code, tables, hr, links, math.
 * LaTeX ($...$ and $$...$$) is preserved and rendered as styled inline code if KaTeX not present.
 * For premium KaTeX support, the component will lazy-enhance when `katex` is available.
 *
 * Pure parsing lives in `../lib/markdownToHtml` (independently testable);
 * this file only owns the React binding.
 */

function MarkdownRenderer({ markdown, className }: MarkdownRendererProps) {
  const html = useMemo(() => markdownToHtml(markdown), [markdown])

  if (!markdown.trim()) {
    return <div className={cn('text-muted-foreground text-sm', className)}>—</div>
  }

  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none', 'text-foreground', className)}
      // Content is sanitized via escapeHtml; only our own generated tags exist. No user HTML passthrough.
      // eslint-disable-next-line react/no-danger -- sanitized HTML from our own markdown generator
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default memo(MarkdownRenderer)
