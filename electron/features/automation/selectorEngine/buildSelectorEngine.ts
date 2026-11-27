/**
 * Builds the source of the Chrome extension's selector engine.
 *
 * The extension is plain JavaScript without a build step, but the selector
 * algorithm must not exist twice. This module therefore emits the *already
 * used* picker sources — the same `pickerDomRuntime` helpers and the same
 * targeting block the Electron picker injects — as one classic script the
 * extension loads before its own content script.
 *
 * `scripts/generate-extension-selector-engine.mjs` bundles this module and
 * writes the result to `extensions/quizlab-session-extension/content/selector-engine.js`.
 * The generated file is committed so the folder Chrome loads is complete, and
 * the drift check fails when it no longer matches this source.
 */
import { buildInjectedPickerDomHelpers } from '../lib/injectedPickerDom.js'
import { buildPickerTargetingBlock } from '../pickerScript/targeting.js'

/**
 * Where the generated engine lands is pinned by the generator script and the
 * drift test, not re-exported here: a second declaration of the path is exactly
 * the kind of copy that drifts.
 */

/**
 * The engine's header.
 *
 * The file is generated; the warning keeps a hand edit from silently becoming
 * the second copy of the algorithm.
 */
const HEADER = `/**
 * Quizlab magic selector engine — GENERATED FILE, DO NOT EDIT.
 *
 * Source of truth: electron/features/automation/lib/dom/pickerDomRuntime.ts and
 * electron/features/automation/pickerScript/targeting.ts. Regenerate with
 * \`node scripts/generate-extension-selector-engine.mjs\`.
 *
 * Loaded by the extension content script, so the Chrome picker and the
 * Electron picker describe elements with the exact same rules.
 */
`

/**
 * The public surface of the generated engine.
 *
 * The content script only calls these three: the target the pointer actually
 * resolves to, the classification shown in the hover label, and the locator
 * bundle that is sent to the app.
 */
function buildExportsBlock(): string {
  return `
  function normalizeTargetForKind(kind, element, path) {
      step = kind === 'input' ? 'input' : 'submit';
      return normalizeTarget(element, path);
  }

  return {
      generateLocatorBundle: generateLocatorBundle,
      getElementInfo: getElementInfo,
      normalizeTargetForKind: normalizeTargetForKind,
      isTextEntryControl: isTextEntryControl,
      findTextEntryControl: findTextEntryControl,
      isButtonLikeNode: isButtonLikeNode,
      inferSendLikeControl: inferSendLikeControl,
      deepActiveElement: deepActiveElement
  };
`
}

/**
 * The whole classic script.
 *
 * The targeting block reads `step`, `mainDoc`, `inferSendLikeControl` and
 * `isElementContentEditable` from its closure, exactly like the picker script
 * does; all four are defined here. `var` at the top level of an injected file
 * becomes a property of the isolated world, which is how the following
 * `content/picker.js` file finds it.
 */
export function buildSelectorEngineSource(): string {
  return `${HEADER}var QuizlabSelectorEngine = (function () {
  'use strict';
${buildInjectedPickerDomHelpers()}
  const mainDoc = document;
  let step = 'input';
${buildPickerTargetingBlock()}${buildExportsBlock()}})();
`
}
