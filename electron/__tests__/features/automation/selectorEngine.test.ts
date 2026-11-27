/**
 * The generated selector engine is the *only* selector algorithm the Chrome
 * picker runs.
 *
 * These tests pin two things the app depends on:
 *   - the committed engine still matches the picker sources it is generated
 *     from (the drift gate);
 *   - the engine keeps the target-integrity rules the Electron picker had:
 *     a picked twin is never silently described by its twin's selector.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildSelectorEngineSource } from '../../../features/automation/selectorEngine/buildSelectorEngine.js'

const ENGINE_PATH = path.join(
  process.cwd(),
  'extensions/quizlab-session-extension/content/selector-engine.js'
)

interface LocatorBundle {
  primarySelector: string | null
  candidates: string[]
  fingerprint: { tag: string; placeholder?: string | null; dataTestId?: string | null }
}

interface SelectorEngine {
  generateLocatorBundle: (el: Element, kind: 'input' | 'button') => LocatorBundle | null
  getElementInfo: (el: Element) => { category: string; labelEN: string }
  normalizeTargetForKind: (kind: 'input' | 'button', el: Element, path?: EventTarget[]) => Element
}

/** Loads the generated classic script and returns its public surface. */
function loadEngine(): SelectorEngine {
  const source = readFileSync(ENGINE_PATH, 'utf-8')
  // `var QuizlabSelectorEngine` is function-scoped inside the wrapper, which is
  // exactly how the injected file exposes it to the next content script.
  return new Function(`${source}\n;return QuizlabSelectorEngine;`)() as SelectorEngine
}

function append<T extends Element>(element: T): T {
  document.body.appendChild(element)
  return element
}

describe('generated chrome selector engine', () => {
  it('generates a self-contained engine script', () => {
    const source = buildSelectorEngineSource()
    expect(source).toContain('var QuizlabSelectorEngine')
    expect(source).toContain('const generateLocatorBundle =')
    expect(source).toContain('const normalizeTarget =')
  })

  it('is up to date with the picker sources it is generated from', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ['scripts/generate-extension-selector-engine.mjs', '--check'],
        {
          cwd: process.cwd(),
          stdio: 'pipe'
        }
      )
    ).not.toThrow()
  })

  it('classifies the composer and the send button like the Electron picker', () => {
    const engine = loadEngine()
    const composer = append(document.createElement('div'))
    composer.setAttribute('role', 'textbox')
    composer.setAttribute('contenteditable', 'true')
    const button = append(document.createElement('button'))
    button.setAttribute('data-testid', 'send-button')

    expect(engine.getElementInfo(composer)).toMatchObject({ category: 'input' })
    expect(engine.getElementInfo(button)).toMatchObject({ category: 'button' })
  })

  it('resolves a duplicate id to the picked element, not to its twin', () => {
    const engine = loadEngine()
    const first = append(document.createElement('input'))
    first.setAttribute('id', 'dup')
    first.setAttribute('type', 'text')
    const second = append(document.createElement('input'))
    second.setAttribute('id', 'dup')
    second.setAttribute('type', 'text')
    second.setAttribute('placeholder', 'Target composer')

    const bundle = engine.generateLocatorBundle(second, 'input')
    expect(bundle).not.toBeNull()
    expect(bundle?.primarySelector).toBeTruthy()
    expect(document.querySelector(bundle?.primarySelector as string)).toBe(second)
  })

  it('keeps the picked composer among the verifiable candidates when a test id repeats', () => {
    const engine = loadEngine()
    const first = append(document.createElement('textarea'))
    first.setAttribute('data-testid', 'composer')
    const second = append(document.createElement('textarea'))
    second.setAttribute('data-testid', 'composer')
    second.setAttribute('placeholder', 'Second composer')

    const bundle = engine.generateLocatorBundle(second, 'input')
    expect(bundle).not.toBeNull()
    const resolvesToPicked = (bundle?.candidates ?? []).some((candidate) => {
      try {
        return document.querySelector(candidate) === second
      } catch {
        return false
      }
    })
    expect(resolvesToPicked).toBe(true)
  })

  it('keeps the fingerprint of the picked element when two composers exist', () => {
    const engine = loadEngine()
    const first = append(document.createElement('textarea'))
    first.setAttribute('placeholder', 'Ask anything')
    const second = append(document.createElement('textarea'))
    second.setAttribute('placeholder', 'Search messages')

    const bundle = engine.generateLocatorBundle(second, 'input')
    expect(bundle?.fingerprint.placeholder).toBe('Search messages')
    expect(document.querySelector(bundle?.primarySelector as string)).toBe(second)
  })

  it('scopes uniqueness to the shadow root the element lives in', () => {
    const engine = loadEngine()
    const host = append(document.createElement('div'))
    const shadow = host.attachShadow({ mode: 'open' })
    // An unrelated light-DOM button with the same shape must not win.
    append(document.createElement('button'))
    const shadowButton = document.createElement('button')
    shadowButton.setAttribute('data-testid', 'shadow-send')
    shadow.appendChild(shadowButton)

    const bundle = engine.generateLocatorBundle(shadowButton, 'button')
    expect(bundle?.primarySelector).toBe('button[data-testid="shadow-send"]')
    expect(shadow.querySelector(bundle?.primarySelector as string)).toBe(shadowButton)
  })

  it('normalizes a role=textbox composer shell to the editable control inside it', () => {
    const engine = loadEngine()
    const composer = append(document.createElement('div'))
    composer.setAttribute('role', 'textbox')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    editable.setAttribute('data-testid', 'prompt-textarea')
    composer.appendChild(editable)

    const resolved = engine.normalizeTargetForKind('input', composer)
    expect(resolved).toBe(editable)
  })
})
