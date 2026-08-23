/* eslint-disable react/no-array-index-key -- list items use index as key, no stable id available from Docling */
import type { QuizLabBlock } from '@shared-core/types'

import { cn } from '@shared/lib/uiUtils'

import { BlockWrapper } from './ReaderBlockShell'
import { ImageBlockView, TableBlockView } from './ReaderMediaBlocks'

export function HeadingBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'heading' }> }) {
  const Tag = `h${Math.min(6, Math.max(1, block.level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  const level1 = block.level === 1
  return (
    <BlockWrapper block={block}>
      <Tag
        className={cn(
          'text-foreground mt-7 mb-2 font-semibold tracking-tight first:mt-0',
          level1
            ? 'border-primary/40 relative border-l-2 pl-3 text-[1.35rem] leading-7'
            : 'text-ql-15 text-[1.1rem] opacity-95'
        )}
      >
        {block.text}
      </Tag>
    </BlockWrapper>
  )
}

export function ParagraphBlockView({
  block
}: {
  block: Extract<QuizLabBlock, { type: 'paragraph' }>
}) {
  return (
    <BlockWrapper block={block}>
      <p className="text-foreground/90 text-ql-14 my-3 leading-7 select-text">{block.text}</p>
    </BlockWrapper>
  )
}

export function ListBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'list' }> }) {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <BlockWrapper block={block}>
      <Tag
        className={cn(
          'my-3 list-outside space-y-1 pl-6',
          block.ordered ? 'list-decimal' : 'list-disc'
        )}
      >
        {block.items.map((item, i) => (
          <li key={i} className="text-ql-14 leading-7 select-text">
            {item}
          </li>
        ))}
      </Tag>
    </BlockWrapper>
  )
}

export function CodeBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'code' }> }) {
  return (
    <BlockWrapper block={block}>
      <pre className="bg-muted border-border text-ql-13 my-4 overflow-x-auto rounded-xl border p-4 font-mono leading-6">
        <code>{block.text}</code>
      </pre>
    </BlockWrapper>
  )
}

export function FormulaBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'formula' }> }) {
  return (
    <BlockWrapper block={block}>
      <div className="bg-muted/40 border-border text-ql-13 my-4 rounded-xl border p-4 font-mono">
        {block.latex ?? block.text}
      </div>
    </BlockWrapper>
  )
}

export function CaptionView({ block }: { block: Extract<QuizLabBlock, { type: 'caption' }> }) {
  return (
    <BlockWrapper block={block}>
      <p className="text-muted-foreground text-ql-12 my-2 italic select-text">{block.text}</p>
    </BlockWrapper>
  )
}

export function UnknownBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'unknown' }> }) {
  if (!block.rawText) return null
  return (
    <BlockWrapper block={block}>
      <p className="text-muted-foreground text-ql-13 my-3 leading-7 select-text">{block.rawText}</p>
    </BlockWrapper>
  )
}

export function ListItemView({ block }: { block: Extract<QuizLabBlock, { type: 'list_item' }> }) {
  return (
    <BlockWrapper block={block}>
      <p className="text-ql-14 my-1 ml-6 list-item list-disc leading-7 select-text">{block.text}</p>
    </BlockWrapper>
  )
}

export function BlockRenderer({ block }: { block: QuizLabBlock }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlockView block={block as Extract<QuizLabBlock, { type: 'heading' }>} />
    case 'paragraph':
      return <ParagraphBlockView block={block as Extract<QuizLabBlock, { type: 'paragraph' }>} />
    case 'list':
      return <ListBlockView block={block as Extract<QuizLabBlock, { type: 'list' }>} />
    case 'list_item':
      return <ListItemView block={block as Extract<QuizLabBlock, { type: 'list_item' }>} />
    case 'image':
      return <ImageBlockView block={block as Extract<QuizLabBlock, { type: 'image' }>} />
    case 'table':
      return <TableBlockView block={block as Extract<QuizLabBlock, { type: 'table' }>} />
    case 'caption':
      return <CaptionView block={block as Extract<QuizLabBlock, { type: 'caption' }>} />
    case 'code':
      return <CodeBlockView block={block as Extract<QuizLabBlock, { type: 'code' }>} />
    case 'formula':
      return <FormulaBlockView block={block as Extract<QuizLabBlock, { type: 'formula' }>} />
    case 'unknown':
      return <UnknownBlockView block={block as Extract<QuizLabBlock, { type: 'unknown' }>} />
    default:
      return (
        <BlockWrapper block={block}>
          <p className="text-ql-13 my-2 select-text">
            {(block as unknown as { text?: string }).text ?? ''}
          </p>
        </BlockWrapper>
      )
  }
}
