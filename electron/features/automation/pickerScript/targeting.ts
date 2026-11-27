/** Event path / hover target normalization (uses step, inferSendLikeControl). */
export function buildPickerTargetingBlock(): string {
  return `        const getEventContext = (event) => {
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
`
}
