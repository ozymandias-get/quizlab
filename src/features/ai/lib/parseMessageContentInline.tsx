import type { ReactNode } from 'react'

import { INLINE_REGEX, isSafeUrl } from './parseMessageContentRegex'

export function formatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = INLINE_REGEX
  regex.lastIndex = 0
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    if (match[1]) {
      parts.push(
        <code
          key={`c-${match.index}`}
          className="text-ql-12 border-border bg-muted/60 text-primary rounded border px-1 py-0.5 font-mono"
        >
          {match[1].slice(1, -1)}
        </code>
      )
    } else if (match[2]) {
      parts.push(
        <strong key={`b-${match.index}`} className="text-foreground font-semibold">
          {match[2].slice(2, -2)}
        </strong>
      )
    } else if (match[3]) {
      parts.push(
        <em key={`i-${match.index}`} className="text-foreground/90 italic">
          {match[3].slice(1, -1)}
        </em>
      )
    } else if (match[4]) {
      parts.push(
        <span key={`s-${match.index}`} className="text-muted-foreground line-through">
          {match[4].slice(2, -2)}
        </span>
      )
    } else if (match[5]) {
      const isBareUrl = !match[5].includes('](')
      if (isBareUrl) {
        const url = match[5]
        if (!isSafeUrl(url)) {
          parts.push(<span key={`a-${match.index}`}>{match[5]}</span>)
        } else {
          parts.push(
            <a
              key={`a-${match.index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary decoration-primary/30 hover:decoration-primary/60 underline underline-offset-2 transition-colors"
            >
              {url}
            </a>
          )
        }
      } else {
        const urlEnd = match[5].indexOf('](')
        const linkText = match[5].slice(1, urlEnd)
        const linkUrl = match[5].slice(urlEnd + 2, -1)
        if (!isSafeUrl(linkUrl)) {
          parts.push(<span key={`a-${match.index}`}>{match[5]}</span>)
        } else {
          parts.push(
            <a
              key={`a-${match.index}`}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary decoration-primary/30 hover:decoration-primary/60 underline underline-offset-2 transition-colors"
            >
              {linkText}
            </a>
          )
        }
      }
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return parts
}

export { isSafeUrl } from './parseMessageContentRegex'
