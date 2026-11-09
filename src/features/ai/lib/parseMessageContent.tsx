import { useDeferredValue, useMemo } from 'react'

import { renderContent } from './parseMessageContentRender'

function MessageContent({ content }: { content: string }) {
  // A streaming reply replaces `content` many times per second, and parsing the
  // whole message each time competes with the commit that paints the new token.
  // Deferring the value lets React keep the previous parse on screen and skip
  // intermediate ones when updates arrive faster than a render; the final text
  // always lands, and a non-streaming message is unaffected.
  const deferredContent = useDeferredValue(content)
  const rendered = useMemo(() => renderContent(deferredContent), [deferredContent])
  return <div className="space-y-0.5">{rendered}</div>
}

export default MessageContent
