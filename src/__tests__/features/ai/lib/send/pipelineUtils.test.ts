import { executePipelineStep } from '@features/ai/lib/send/pipelineUtils'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSendWebviewMock, makePipelineParams } from './sharedTestHelpers'

describe('executePipelineStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success on happy path', async () => {
    const params = makePipelineParams({ name: 'Test_step' })
    const result = await executePipelineStep(params)

    expect(result.success).toBe(true)
    expect(params.onTiming).toHaveBeenCalled()
    expect(params.onExecuteTiming).toHaveBeenCalled()
    expect(params.onResult).toHaveBeenCalled()
  })

  it('returns failure when script generation returns null', async () => {
    const params = makePipelineParams({
      generateScript: vi.fn().mockResolvedValue(null)
    })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'send_script_failed')
    }
    expect((params.webview as any).executeJavaScript).not.toHaveBeenCalled()
  })

  it('returns failure when webview is destroyed', async () => {
    const params = makePipelineParams({
      canUseWebview: vi.fn().mockReturnValue(false)
    })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'webview_destroyed')
    }
    expect((params.webview as any).executeJavaScript).not.toHaveBeenCalled()
  })

  it('returns failure when script execution fails', async () => {
    const webview = createSendWebviewMock()
    ;(webview as any).executeJavaScript = vi.fn().mockResolvedValue({
      success: false,
      error: 'exec error'
    })

    const params = makePipelineParams({ webview, scheduledWebview: webview })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'exec error')
    }
  })

  it('returns failure when execution result is null', async () => {
    const webview = createSendWebviewMock()
    ;(webview as any).executeJavaScript = vi.fn().mockResolvedValue(null)

    const params = makePipelineParams({ webview, scheduledWebview: webview })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'send_failed')
    }
  })

  it('calls onResult with normalized execution result', async () => {
    const webview = createSendWebviewMock()
    ;(webview as any).executeJavaScript = vi.fn().mockResolvedValue({
      success: true,
      mode: 'enter'
    })

    const params = makePipelineParams({ webview, scheduledWebview: webview })
    await executePipelineStep(params)

    expect(params.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, mode: 'enter' })
    )
  })

  it('records timing for both script generation and execution', async () => {
    const params = makePipelineParams()
    await executePipelineStep(params)

    expect(params.onTiming).toHaveBeenCalledWith(expect.any(Number))
    expect(params.onExecuteTiming).toHaveBeenCalledWith(expect.any(Number))
  })
})
