import { useMemo } from 'react'

import { renderContent } from './parseMessageContentRender'

function MessageContent({ content }: { content: string }) {
  const rendered = useMemo(() => renderContent(content), [content])
  return <div className="space-y-0.5">{rendered}</div>
}

export default MessageContent
