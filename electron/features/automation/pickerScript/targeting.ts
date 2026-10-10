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

        const normalizeTarget = (rawTarget, optPath) => {
            if (!rawTarget) return null;
            if (rawTarget.nodeType !== 1) return null;
            var target = rawTarget;

            if (step === 'submit' || step === 'typing') {
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

            var buttonAncestor = target.closest('button, [role="button"], a');
            if (buttonAncestor && target !== buttonAncestor) {
                target = buttonAncestor;
            }

            var textbox = target.closest('[role="textbox"], [contenteditable="true"], input, textarea');
            if (textbox && target !== textbox) {
                if (!target.closest('button, [role="button"], a')) {
                    target = textbox;
                }
            }

            return target;
        };
`
}
