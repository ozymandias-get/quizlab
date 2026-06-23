import { contextBridge, ipcRenderer } from 'electron'

/**
 * Read the dynamic channel names passed via additionalArguments.
 * Each picker window gets its own isolated channels so multiple
 * pickers cannot collide if opened concurrently.
 */
const argPrefix = '--picker-ch-'
const selectCh = process.argv
  .find((a) => a.startsWith(`${argPrefix}select=`))
  ?.slice(`${argPrefix}select=`.length)
const cancelCh = process.argv
  .find((a) => a.startsWith(`${argPrefix}cancel=`))
  ?.slice(`${argPrefix}cancel=`.length)
const sourcesCh = process.argv
  .find((a) => a.startsWith(`${argPrefix}sources=`))
  ?.slice(`${argPrefix}sources=`.length)

// Fallback to static names (shouldn't happen in normal operation).
const SELECT = selectCh ?? 'display-media-picker:select'
const CANCEL = cancelCh ?? 'display-media-picker:cancel'
const SOURCES = sourcesCh ?? 'display-media-picker:sources'

type SourceRow = { id: string; name: string; thumbnailDataUrl: string }

contextBridge.exposeInMainWorld('displayMediaPicker', {
  onSources: (cb: (sources: SourceRow[]) => void) => {
    ipcRenderer.once(SOURCES, (_e, sources: SourceRow[]) => {
      cb(sources)
    })
  },
  select: (index: number) => ipcRenderer.send(SELECT, index),
  cancel: () => ipcRenderer.send(CANCEL)
})
