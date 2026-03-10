/**
 * Automation & Selector Types
 */

export type SubmitMode = 'click' | 'enter_key' | 'mixed' | string

export type SelectorHealth = 'ready' | 'migrated' | 'needs_repick'

export interface AutomationHostDescriptor {
  selector: string
  tag: string
  safeId?: string | null
  dataTestId?: string | null
  classTokens?: string[] | null
  nthChild?: number | null
}

export interface AutomationElementFingerprint {
  tag: string
  role?: string | null
  type?: string | null
  contentEditable?: boolean
  text?: string | null
  name?: string | null
  placeholder?: string | null
  ariaLabel?: string | null
  dataTestId?: string | null
  safeId?: string | null
  classTokens?: string[] | null
  localPath?: string[] | null
  hostChain?: AutomationHostDescriptor[] | null
}

export type AiSelectorConfig = {
  version?: 2
  input?: string | null
  button?: string | null
  waitFor?: string | null
  submitMode?: SubmitMode
  inputCandidates?: string[] | null
  buttonCandidates?: string[] | null
  inputFingerprint?: AutomationElementFingerprint | null
  buttonFingerprint?: AutomationElementFingerprint | null
  sourceUrl?: string | null
  sourceHostname?: string | null
  canonicalHostname?: string | null
  health?: SelectorHealth
  [key: string]: unknown
}

export type AutomationConfig = {
  version?: 2
  input?: string | null
  button?: string | null
  waitFor?: string | null
  submitMode?: SubmitMode
  inputCandidates?: string[] | null
  buttonCandidates?: string[] | null
  inputFingerprint?: AutomationElementFingerprint | null
  buttonFingerprint?: AutomationElementFingerprint | null
  sourceUrl?: string | null
  sourceHostname?: string | null
  canonicalHostname?: string | null
  health?: SelectorHealth
  [key: string]: unknown
}

export type AutomationLookupStrategy = 'cache' | 'direct' | 'recursive' | 'fingerprint' | 'none'

export interface AutomationSelectorDiagnostics {
  requestedSelector: string | null
  matchedSelector: string | null
  strategy: AutomationLookupStrategy
  durationMs: number
  waitIterations: number
  cacheHits: number
  cacheInvalidations: number
  interactiveRequired: boolean
}

export interface AutomationExecutionDiagnostics {
  kind: 'focus' | 'auto_send' | 'click_send' | 'validate' | 'submit_ready'
  pageUrl: string
  totalMs: number
  input: AutomationSelectorDiagnostics
  button?: AutomationSelectorDiagnostics
  setInputMs: number
  submitMs: number
  error: string | null
}

export interface AutomationExecutionResult {
  success: boolean
  error?: string
  mode?: string
  action?: string
  diagnostics?: AutomationExecutionDiagnostics
}
