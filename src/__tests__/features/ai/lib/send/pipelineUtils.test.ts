import { describe, expect, it, vi, beforeEach } from 'vitest'
import { executePipelineStep } from '@features/ai/lib/send/pipelineUtils'
import type { PipelineStepParams } from '@features/ai/lib/send/pipelineUtils'
import type { WebviewController } from '@shared-core/types/webview'

const emitEvent = vi.fn()

vi.mock('@features/diagnostics', () => ({
  useDiagnosticsStore: {
    getState: () => ({ emitEvent })
  }
}))

function createWebviewMock(): WebviewController {
  return {
    executeJavaScript: vi.fn().mockResolvedValue({ success: true }),
    isDestroyed: () => false,
    getURL: () => 'https://example.com',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as WebviewController
}

function makeParams(overrides: Partial<PipelineStepParams> = {}): PipelineStepParams {
  const webview = createWebviewMock()
  return {
    name: 'Test_step',
    webview,
    scheduledWebview: webview,
    diagnostics: {
      currentAI: 'chatgpt',
      timings: {}
    } as any,
    requestStartedAt: Date.now(),
    canUseWebview: vi.fn().mockReturnValue(true),
    generateScript: vi.fn().mockResolvedValue('return true;'),
    onTiming: vi.fn(),
    onExecuteTiming: vi.fn(),
    onResult: vi.fn(),
    ...overrides
  }
}

describe('executePipelineStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success on happy path', async () => {
    const params = makeParams()
    const result = await executePipelineStep(params)

    expect(result.success).toBe(true)
    expect(params.onTiming).toHaveBeenCalled()
    expect(params.onExecuteTiming).toHaveBeenCalled()
    expect(params.onResult).toHaveBeenCalled()
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCRIPT_GENERATED' }))
  })

  it('returns failure when script generation returns null', async () => {
    const params = makeParams({
      generateScript: vi.fn().mockResolvedValue(null)
    })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'test_step_script_failed')
    }
    expect((params.webview as any).executeJavaScript).not.toHaveBeenCalled()
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PIPELINE_ERROR',
        pipelineStage: 'script_generation'
      })
    )
  })

  it('returns failure when webview is destroyed', async () => {
    const params = makeParams({
      canUseWebview: vi.fn().mockReturnValue(false)
    })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'webview_destroyed')
    }
    expect((params.webview as any).executeJavaScript).not.toHaveBeenCalled()
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PIPELINE_ERROR',
        message: 'Webview destroyed during pipeline execution'
      })
    )
  })

  it('returns failure when script execution fails', async () => {
    const webview = createWebviewMock()
    ;(webview as any).executeJavaScript = vi.fn().mockResolvedValue({
      success: false,
      error: 'exec error'
    })

    const params = makeParams({ webview, scheduledWebview: webview })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'exec error')
    }
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PIPELINE_ERROR',
        pipelineStage: 'script_execution'
      })
    )
  })

  it('returns failure when execution result is null', async () => {
    const webview = createWebviewMock()
    ;(webview as any).executeJavaScript = vi.fn().mockResolvedValue(null)

    const params = makeParams({ webview, scheduledWebview: webview })

    const result = await executePipelineStep(params)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toHaveProperty('error', 'test_step_failed')
    }
  })

  it('emits SUBMIT_READY event for Submit_ready step', async () => {
    const params = makeParams({ name: 'Submit_ready' })
    await executePipelineStep(params)

    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SUBMIT_READY',
        pipelineStage: 'submit_ready'
      })
    )
  })

  it('calls onResult with normalized execution result', async () => {
    const webview = createWebviewMock()
    ;(webview as any).executeJavaScript = vi.fn().mockResolvedValue({
      success: true,
      mode: 'enter'
    })

    const params = makeParams({ webview, scheduledWebview: webview })
    await executePipelineStep(params)

    expect(params.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, mode: 'enter' })
    )
  })

  it('records timing for both script generation and execution', async () => {
    const params = makeParams()
    await executePipelineStep(params)

    expect(params.onTiming).toHaveBeenCalledWith(expect.any(Number))
    expect(params.onExecuteTiming).toHaveBeenCalledWith(expect.any(Number))
  })
})
