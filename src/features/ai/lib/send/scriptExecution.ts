import type { AutomationExecutionDiagnostics, AutomationExecutionResult } from '@shared-core/types'

export function normalizeExecutionResult(value: unknown): AutomationExecutionResult | null {
  if (typeof value === 'boolean') {
    return { success: value }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<AutomationExecutionResult>
  return {
    success: typeof candidate.success === 'boolean' ? candidate.success : !candidate.error,
    error: candidate.error,
    mode: candidate.mode,
    action: candidate.action,
    diagnostics: candidate.diagnostics
  }
}

export function cloneScriptDiagnostics(
  diagnostics?: AutomationExecutionDiagnostics | null
): AutomationExecutionDiagnostics | null {
  return diagnostics
    ? (JSON.parse(JSON.stringify(diagnostics)) as AutomationExecutionDiagnostics)
    : null
}
