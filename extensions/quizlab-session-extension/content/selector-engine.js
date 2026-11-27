/**
 * Quizlab magic selector engine — GENERATED FILE, DO NOT EDIT.
 *
 * Source of truth: electron/features/automation/lib/dom/pickerDomRuntime.ts and
 * electron/features/automation/pickerScript/targeting.ts. Regenerate with
 * `node scripts/generate-extension-selector-engine.mjs`.
 *
 * Loaded by the extension content script, so the Chrome picker and the
 * Electron picker describe elements with the exact same rules.
 */
var QuizlabSelectorEngine = (function () {
  'use strict';
        const GENERATED_TOKEN_REGEX = /(^--)|(^\d{5,}$)|([\da-z]{15,})|([a-z]+[_-]\d{5,}$)/i;
        const SAFE_CLASS_TOKEN_REGEX = /^[A-Za-z][\w-]{0,63}$/;
        const getSafeId = function getSafeId(el) {
  const id = el.getAttribute("id");
  if (!id || GENERATED_TOKEN_REGEX.test(id)) return null;
  return id;
};
        const getNthChild = function getNthChild(el) {
  const parent = el.parentElement;
  if (!parent) return null;
  const children = [...parent.children];
  const index = children.indexOf(el);
  return index >= 0 ? index + 1 : null;
};
        const getSafeClassTokens = function getSafeClassTokens(el) {
  const HASHED_UTILITY_CLASS_REGEX = /^(?=[a-z0-9]*\d)[a-z0-9]{1,12}$/;
  return [...el.classList].map((token) => token.trim()).filter(
    (token) => token && SAFE_CLASS_TOKEN_REGEX.test(token) && !GENERATED_TOKEN_REGEX.test(token) && !HASHED_UTILITY_CLASS_REGEX.test(token)
  ).slice(0, 3);
};
        const normalizeText = function normalizeText(value) {
  return String(value || "").replaceAll(/\s+/g, " ").trim();
};
        const getVisibleText = function getVisibleText(el) {
  const textValue = normalizeText(
    el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt")
  );
  return textValue ? textValue.slice(0, 256) : null;
};
        const pushCandidate = function pushCandidate(target, selector) {
  if (!selector) return;
  const normalized = selector.trim();
  if (!normalized || target.includes(normalized)) return;
  target.push(normalized);
};
        const getPrimaryAttribute = function getPrimaryAttribute(el, kind) {
  const candidates = kind === "input" ? ["data-testid", "name", "placeholder", "aria-label"] : ["data-testid", "aria-label", "title", "name"];
  for (const attribute of candidates) {
    const val = el.getAttribute(attribute);
    if (val && val.trim() && val.length < 256) {
      return { attribute, value: val.trim() };
    }
  }
  return null;
};
        const isElementContentEditable = function isElementContentEditable(el) {
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) return true;
  } else if (el.isContentEditable) {
    return true;
  }
  return el.getAttribute("contenteditable") === "true";
};
        const cssEscape = function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replaceAll(/[!"#$%&'()*+,.\/:;<=>?@[\]^`{|}~]/g, "\\$&");
};
        const escapeCssStringValue = function escapeCssStringValue(str) {
  if (typeof str !== "string" || !str) return "";
  return str.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
};
        const buildSelectorSegment = function buildSelectorSegment(el) {
  const tag = el.tagName.toLowerCase();
  const safeId = getSafeId(el);
  if (safeId) {
    return `#${cssEscape(safeId)}`;
  }
  const testId = el.getAttribute("data-testid");
  if (testId && testId.length < 256) {
    return `${tag}[data-testid="${escapeCssStringValue(testId)}"]`;
  }
  const nthChild = getNthChild(el);
  return nthChild ? `${tag}:nth-child(${nthChild})` : tag;
};
        const buildLocalPath = function buildLocalPath(el) {
  const path = [];
  let current = el;
  while (current) {
    path.unshift(buildSelectorSegment(current));
    current = current.parentElement;
    if (path.length >= 8) break;
  }
  return path;
};
        const buildHostChain = function buildHostChain(el) {
  const hostChain = [];
  let currentRoot = el.getRootNode();
  while (currentRoot && "host" in currentRoot && currentRoot.host instanceof Element) {
    const host = currentRoot.host;
    hostChain.unshift({
      selector: buildSelectorSegment(host),
      tag: host.tagName.toLowerCase(),
      safeId: getSafeId(host),
      dataTestId: host.getAttribute("data-testid"),
      classTokens: getSafeClassTokens(host),
      nthChild: getNthChild(host)
    });
    currentRoot = host.getRootNode();
  }
  return hostChain;
};
        const buildCssCandidates = function buildCssCandidates(el, kind) {
  const tag = el.tagName.toLowerCase();
  const candidates = [];
  const safeId = getSafeId(el);
  const testId = el.getAttribute("data-testid");
  const name = el.getAttribute("name");
  const placeholder = el.getAttribute("placeholder");
  const ariaLabel = el.getAttribute("aria-label");
  const title = el.getAttribute("title");
  const role = el.getAttribute("role");
  const type = el.getAttribute("type");
  const classTokens = getSafeClassTokens(el);
  const isContentEditable = isElementContentEditable(el);
  if (safeId) {
    pushCandidate(candidates, `#${cssEscape(safeId)}`);
  }
  if (testId && testId.length < 256) {
    pushCandidate(candidates, `${tag}[data-testid="${escapeCssStringValue(testId)}"]`);
    pushCandidate(candidates, `[data-testid="${escapeCssStringValue(testId)}"]`);
  }
  if (name && name.length < 256) {
    pushCandidate(candidates, `${tag}[name="${escapeCssStringValue(name)}"]`);
  }
  if (placeholder && placeholder.length < 256) {
    pushCandidate(candidates, `${tag}[placeholder="${escapeCssStringValue(placeholder)}"]`);
  }
  if (kind === "button" && el.hasAttribute("data-composer-submit")) {
    pushCandidate(candidates, "[data-composer-submit]");
  }
  if (ariaLabel && ariaLabel.length < 256) {
    pushCandidate(candidates, `${tag}[aria-label="${escapeCssStringValue(ariaLabel)}"]`);
    if (role) {
      pushCandidate(
        candidates,
        `[role="${cssEscape(role)}"][aria-label="${escapeCssStringValue(ariaLabel)}"]`
      );
    }
  }
  if (kind === "button" && title && title.length < 256) {
    pushCandidate(candidates, `${tag}[title="${escapeCssStringValue(title)}"]`);
  }
  if (role) {
    pushCandidate(candidates, `${tag}[role="${cssEscape(role)}"]`);
  }
  if (type) {
    pushCandidate(candidates, `${tag}[type="${escapeCssStringValue(type)}"]`);
  }
  if (kind === "input" && isContentEditable) {
    pushCandidate(candidates, `${tag}[contenteditable="true"]`);
    if (role) {
      pushCandidate(candidates, `${tag}[contenteditable="true"][role="${cssEscape(role)}"]`);
    }
  }
  if (classTokens.length > 0) {
    pushCandidate(
      candidates,
      `${tag}${classTokens.map((token) => `.${cssEscape(token)}`).join("")}`
    );
    if (role) {
      pushCandidate(
        candidates,
        `${tag}[role="${cssEscape(role)}"]${classTokens.map((token) => `.${cssEscape(token)}`).join("")}`
      );
    }
  }
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tag)) {
    pushCandidate(candidates, tag);
  }
  return candidates.slice(0, 12);
};
        const safeMatchesSelector = function safeMatchesSelector(el, selector) {
  try {
    if (!el || typeof selector !== "string" || !selector.trim()) return false;
    if (typeof el.matches !== "function") return false;
    return el.matches(selector);
  } catch {
    return false;
  }
};
        const pickVerifiedPrimary = function pickVerifiedPrimary(el, candidates) {
  if (!el || !Array.isArray(candidates) || candidates.length === 0) return null;
  const verified = candidates.filter((c) => safeMatchesSelector(el, c));
  if (verified.length === 0) return candidates[0] || null;
  const rootNode = typeof el.getRootNode === "function" ? el.getRootNode() : null;
  const scope = rootNode && typeof rootNode.querySelectorAll === "function" ? rootNode : typeof document !== "undefined" && typeof document.querySelectorAll === "function" ? document : null;
  if (scope) {
    for (const candidate of verified) {
      try {
        const matches = scope.querySelectorAll(candidate);
        if (matches.length === 1 && (!el.isConnected || matches[0] === el)) {
          return candidate;
        }
      } catch {
      }
    }
    if (el.isConnected) {
      for (const candidate of verified) {
        try {
          const matches = scope.querySelectorAll(candidate);
          if (matches.length > 0 && matches[0] === el) {
            return candidate;
          }
        } catch {
        }
      }
    }
  }
  return verified[0] || null;
};
        const inferSendLikeControl = function inferSendLikeControl(el) {
  const R = /\b(send|gönder|submit)\b|send-?message|sendmessage|send_message|composer-?send|send-button|sendbutton|submit_message|message_send|send_/i;
  const al = (el.getAttribute("aria-label") || "").toLowerCase();
  if (R.test(al)) return true;
  const title = (el.getAttribute("title") || "").toLowerCase();
  if (R.test(title)) return true;
  const tid = (el.getAttribute("data-testid") || el.getAttribute("data-test-id") || "").toLowerCase();
  if (R.test(tid)) return true;
  if (el instanceof HTMLElement && typeof el.className === "string") {
    const cls = el.className.toLowerCase();
    if (R.test(cls)) return true;
  }
  return false;
};
        const getElementInfo = function getElementInfo(el) {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  const type = el.getAttribute("type");
  const contentEditable = isElementContentEditable(el);
  if (inferSendLikeControl(el)) {
    return {
      category: "button",
      labelEN: "Send Button",
      labelKey: "picker_el_submit",
      confidence: "high",
      tag,
      hintKey: "picker_hint_submit_correct",
      hintEN: ""
    };
  }
  const hasDictationAttr = el.hasAttribute("data-start-dictation") || el.hasAttribute("data-cancel-dictation") || el.hasAttribute("data-submit-dictation");
  const voiceSignals = [
    el.getAttribute("aria-label") || "",
    el.getAttribute("title") || "",
    el.getAttribute("data-testid") || "",
    el.getAttribute("data-test-id") || "",
    el.getAttribute("name") || ""
  ].join(" ").toLowerCase();
  const VOICE_CONTROL_REGEX = /(^|\s|-|_)(mikrofon|sesli|dikte|konuş|konus|mic|microphone|dictate|dictation|voice|speak|speech|talk|record|recording|transcribe|transcription|audio)(\s|-|_|$)/i;
  if (hasDictationAttr || VOICE_CONTROL_REGEX.test(voiceSignals)) {
    return {
      category: "unknown",
      labelEN: "Voice / Dictation Button",
      confidence: "low",
      tag,
      hintEN: ""
    };
  }
  let category = "unknown";
  let labelEN = "Unknown";
  let confidence = "low";
  let hintEN = "";
  let labelKey;
  let hintKey;
  if (tag === "input") {
    if (type === "text" || type === "search" || !type) {
      category = "input";
      labelEN = "Text Input";
      labelKey = "picker_el_input";
      confidence = "high";
      hintKey = "picker_hint_input_correct";
    } else if (type === "submit" || type === "button") {
      category = "button";
      labelEN = "Submit Button";
      labelKey = "picker_el_submit";
      confidence = "high";
      hintKey = "picker_hint_submit_correct";
    } else {
      category = "input";
      labelEN = "Input Field";
      labelKey = "picker_el_input_field";
      confidence = "medium";
    }
  } else if (tag === "textarea") {
    category = "input";
    labelEN = "Message Box";
    labelKey = "picker_el_msg_box";
    confidence = "high";
    hintKey = "picker_hint_textarea_perfect";
  } else if (tag === "button" || role === "button") {
    category = "button";
    labelEN = "Button";
    labelKey = "picker_el_button";
    confidence = "high";
    hintKey = "picker_hint_button_send";
  } else if (role === "textbox" || contentEditable) {
    category = "input";
    labelEN = "Message Input Area";
    labelKey = "picker_el_msg_area";
    confidence = "high";
    hintKey = "picker_hint_input_correct";
  } else if (tag === "div") {
    const element = el;
    const hasClickHandler = typeof element.onclick === "function";
    const isClickable = hasClickHandler || element.getAttribute("onclick") !== null || window.getComputedStyle(element).cursor === "pointer";
    if (isClickable) {
      category = "button";
      labelEN = "Clickable Area";
      labelKey = "picker_el_clickable";
      confidence = "medium";
      hintKey = "picker_hint_clickable";
    } else {
      category = "container";
      labelEN = "Container";
      labelKey = "picker_el_container";
      confidence = "low";
      hintKey = "picker_hint_generic_box";
    }
  } else if (["svg", "path", "img", "i"].includes(tag)) {
    category = "icon";
    labelEN = "Icon / Image";
    labelKey = "picker_el_icon";
    confidence = "low";
    hintKey = "picker_hint_icon";
  } else if (tag === "a") {
    category = "button";
    labelEN = "Link / Button";
    labelKey = "picker_el_link";
    confidence = "medium";
  } else if (tag === "span") {
    category = "text";
    labelEN = "Text Span";
    labelKey = "picker_el_text";
    confidence = "low";
    hintKey = "picker_hint_text";
  } else if (tag === "form") {
    category = "container";
    labelEN = "Form Container";
    labelKey = "picker_el_form";
    confidence = "low";
    hintKey = "picker_hint_form";
  }
  return { category, labelEN, labelKey, confidence, tag, hintKey, hintEN };
};
        const generateLocatorBundle = function generateLocatorBundle(el, kind) {
  if (!el) return null;
  const tag = el.tagName.toLowerCase();
  const primaryAttribute = getPrimaryAttribute(el, kind);
  const candidates = buildCssCandidates(el, kind);
  const role = el.getAttribute("role");
  const type = el.getAttribute("type");
  const placeholder = el.getAttribute("placeholder");
  const ariaLabel = el.getAttribute("aria-label");
  const contentEditable = isElementContentEditable(el);
  const safeId = getSafeId(el);
  const dataTestId = el.getAttribute("data-testid");
  const classTokens = getSafeClassTokens(el);
  const fingerprint = {
    tag,
    ...role ? { role } : {},
    ...type ? { type } : {},
    ...contentEditable ? { contentEditable: true } : {},
    ...kind === "button" ? { text: getVisibleText(el) } : {},
    ...primaryAttribute?.attribute === "name" ? { name: primaryAttribute.value } : {},
    ...placeholder ? { placeholder } : {},
    ...ariaLabel ? { ariaLabel } : {},
    ...dataTestId ? { dataTestId } : {},
    ...safeId ? { safeId } : {},
    ...classTokens.length > 0 ? { classTokens } : {},
    localPath: buildLocalPath(el),
    hostChain: buildHostChain(el)
  };
  return {
    primarySelector: pickVerifiedPrimary(el, candidates),
    candidates,
    fingerprint
  };
};
  const mainDoc = document;
  let step = 'input';
        const getEventContext = (event) => {
            var path = null;
            var rawTarget = null;
            if (event && typeof event.composedPath === 'function') {
                path = event.composedPath();
                for (var i = 0; i < path.length; i++) {
                    var c = path[i];
                    if (c && c.nodeType === 1) {
                        rawTarget = c;
                        break;
                    }
                }
            } else if (event && event.target) {
                var t = event.target;
                rawTarget = t.nodeType === 1 ? t : (t.parentElement || null);
                path = [];
            }
            return { rawTarget: rawTarget, path: path || [] };
        };

        const ancestorChain = (el) => {
            var a = [];
            var n = el;
            for (var d = 0; n && n.nodeType === 1 && d < 16; d++) {
                a.push(n);
                n = n.parentElement;
            }
            return a;
        };

        const isButtonLikeNode = (node) => {
            if (!node || node.nodeType !== 1) return false;
            try {
                var tag = (node.tagName || '').toLowerCase();
                if (tag === 'button' || tag === 'a') return true;
                if (tag === 'input') {
                    var t = (node.getAttribute && node.getAttribute('type')) || '';
                    if (t === 'submit' || t === 'button') return true;
                }
                if (node.getAttribute && node.getAttribute('role') === 'button') return true;
            } catch (e) { /* attribute read failed: not button-like */ }
            return false;
        };

        // A text-entry control is the element the automation can actually write
        // into: <input> of a text-like type, <textarea>, or a contenteditable
        // root. A bare [role="textbox"] wrapper is deliberately NOT one — the
        // runtime's value setters would write a JS property on a plain <div>
        // and the text would never reach the editor (see resolveTextEntryControl).
        //
        // "contenteditable root" means the editing host, not any descendant:
        // isContentEditable is inherited, so a <p> inside ChatGPT's
        // ProseMirror composer reports true. Resolving that paragraph stored the
        // selector "p", which the app's verifier cannot identify as the composer.
        const isEditableHost = (node) => {
            if (!isElementContentEditable(node)) return false;
            var parent = node.parentElement;
            return !parent || !isElementContentEditable(parent);
        };

        const isTextEntryControl = (node) => {
            if (!node || node.nodeType !== 1) return false;
            try {
                var tag = (node.tagName || '').toLowerCase();
                if (tag === 'textarea') return true;
                if (tag === 'input') {
                    var type = ((node.getAttribute && node.getAttribute('type')) || 'text').toLowerCase();
                    return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].indexOf(type) >= 0;
                }
                return isEditableHost(node);
            } catch (e) { return false; }
        };

        // Nearest self-or-ancestor text-entry control (inner-first). parentElement
        // does not cross shadow roots on purpose: the picker shares the same
        // root as the element it was handed.
        const findTextEntryControl = (node) => {
            var n = node;
            for (var d = 0; n && n.nodeType === 1 && d < 16; d++) {
                if (isTextEntryControl(n)) return n;
                n = n.parentElement;
            }
            return null;
        };

        // Some editors expose a non-editable [role="textbox"] container around
        // the real control (a wrapper div, a custom element, a hidden textarea).
        // Persisting the wrapper yields a locator that automation cannot type
        // into, so resolve down to the control that actually accepts text. A
        // click aimed at a button INSIDE the container stays a button.
        const resolveTextEntryControl = (node) => {
            if (!node || node.nodeType !== 1) return null;
            if (isTextEntryControl(node)) return node;
            var roleBox = null;
            try { roleBox = node.closest('[role="textbox"], [role="searchbox"]'); } catch (e) { roleBox = null; }
            if (!roleBox) return null;
            var control = null;
            try { control = node.closest('button, [role="button"], a'); } catch (e) { control = null; }
            if (control && roleBox.contains(control)) return null;
            var inner = null;
            try { inner = roleBox.querySelector('textarea, input, [contenteditable="true"]'); } catch (e) { inner = null; }
            return inner || roleBox;
        };

        // Clicking the padding of a composer bar (the rounded shell around a
        // 26px text line) is normal user behaviour, but that padding is a plain
        // container, not a text control. Resolve to the editable inside it when
        // the container really is that control's own shell — never when the
        // container is just a page section that happens to include a text box.
        const findNestedTextEntryControl = (node) => {
            if (!node || node.nodeType !== 1) return null;
            try {
                if (node === mainDoc.body || node === mainDoc.documentElement) return null;
                if (isButtonLikeNode(node)) return null;
                if (isTextEntryControl(node)) return node;

                // Hover calls this on every element transition; keep the scan
                // bounded so a page-sized container never triggers a full
                // subtree query.
                if (node.childElementCount > 40) return null;
                var nodeRect = node.getBoundingClientRect();
                if (!nodeRect || nodeRect.width <= 0 || nodeRect.height <= 0) return null;
                if (nodeRect.height > 400 || nodeRect.width > 1600) return null;

                var candidates = node.querySelectorAll('textarea, input, [contenteditable="true"], [role="textbox"]');
                var best = null;
                var bestArea = 0;
                var limit = Math.min(candidates.length, 12);
                for (var i = 0; i < limit; i++) {
                    var candidate = candidates[i];
                    if (!isTextEntryControl(candidate) || candidate.isConnected === false) continue;
                    var rect = candidate.getBoundingClientRect();
                    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
                    // The control must sit inside the shell the user clicked.
                    if (rect.top < nodeRect.top - 4 || rect.bottom > nodeRect.bottom + 4) continue;
                    if (rect.left < nodeRect.left - 4 || rect.right > nodeRect.right + 4) continue;
                    var area = rect.width * rect.height;
                    if (area > bestArea) {
                        best = candidate;
                        bestArea = area;
                    }
                }
                if (!best) return null;
                // A page section is many times larger than the box inside it.
                if (bestArea * 4 < nodeRect.width * nodeRect.height) return null;
                return best;
            } catch (e) { return null; }
        };

        // Document-relative hit test that also descends into open shadow roots.
        // Used for two failures plain event targets cannot cover: a click whose
        // target was replaced by the site between mousedown and click, and a
        // scroll that moved the element under a stationary pointer.
        const deepElementFromPoint = (doc, clientX, clientY) => {
            try {
                if (!doc || typeof doc.elementFromPoint !== 'function') return null;
                var el = doc.elementFromPoint(clientX, clientY);
                for (var d = 0; el && el.shadowRoot && d < 8; d++) {
                    var inner = null;
                    try { inner = el.shadowRoot.elementFromPoint(clientX, clientY); } catch (e) { inner = null; }
                    if (!inner || inner === el) break;
                    el = inner;
                }
                return el || null;
            } catch (e) { return null; }
        };

        // Follow focus through open shadow roots: document.activeElement is the
        // host, not the editor that actually received focus.
        const deepActiveElement = (doc) => {
            try {
                var active = doc && doc.activeElement;
                for (var d = 0; active && active.shadowRoot && active.shadowRoot.activeElement && d < 8; d++) {
                    active = active.shadowRoot.activeElement;
                }
                return active || null;
            } catch (e) { return null; }
        };

        const normalizeTarget = (rawTarget, optPath) => {
            if (!rawTarget) return null;
            if (rawTarget.nodeType !== 1) return null;
            var target = rawTarget;

            if (step === 'submit' || step === 'typing') {
                // Clicking inside a text control must stay a text control. The
                // send-like climb below is meant for wrappers AROUND a button
                // (div.composer-send > button > svg); applied to an input that
                // happens to sit inside a clickable composer wrapper it
                // reported the wrapper as the send button and silently saved
                // the wrong locator.
                var entryControl = findTextEntryControl(rawTarget);
                if (entryControl) return entryControl;
                var nodes = optPath && optPath.length ? optPath : ancestorChain(rawTarget);
                var max = Math.min(nodes.length, 16);
                // Target-integrity: a send-like WRAPPER (e.g. div.composer-send)
                // must not shadow the real button inside it. Collect the
                // innermost send-like node and the innermost button-like node;
                // the interactable control wins so the persisted locator
                // describes the element automation can actually click.
                var sendLike = null;
                var btnLike = null;
                for (var j = 0; j < max; j++) {
                    var node = nodes[j];
                    if (!node || node.nodeType !== 1) continue;
                    if (!sendLike && inferSendLikeControl(node)) sendLike = node;
                    if (!btnLike && isButtonLikeNode(node)) btnLike = node;
                    if (sendLike && btnLike) break;
                }
                if (btnLike) return btnLike;
                if (sendLike) return sendLike;
                var sendBtn = rawTarget.closest('button, [role="button"], a');
                if (sendBtn) return sendBtn;
                return rawTarget;
            }

            // Step 'input': the innermost text-entry control wins, even when a
            // clickable ancestor (role="button" composer shell, card link) wraps
            // it. The old order promoted the button ancestor first and then
            // refused to upgrade to the textbox because it sat inside a
            // button — so clicking the composer of such a site did nothing but
            // flash red.
            var entry = findTextEntryControl(target);
            if (entry) return entry;

            // Role-only textbox container (no own editability): point at the
            // control inside it, otherwise keep the container as a fallback.
            var resolvedEntry = resolveTextEntryControl(target);
            if (resolvedEntry) return resolvedEntry;

            // Composer padding / shell: resolve down to the editable it wraps.
            var nestedEntry = findNestedTextEntryControl(target);
            if (nestedEntry) return nestedEntry;

            // No text control under the pointer: report the control the user
            // actually aimed at so the integrity gate can reject it visibly.
            var buttonAncestor = target.closest('button, [role="button"], a');
            if (buttonAncestor && target !== buttonAncestor) {
                target = buttonAncestor;
            }

            return target;
        };

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
})();
