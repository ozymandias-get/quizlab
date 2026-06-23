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

        const normalizeTarget = (rawTarget, optPath) => {
            if (!rawTarget) return null;
            if (rawTarget.nodeType !== 1) return null;
            var target = rawTarget;

            if (step === 'submit' || step === 'typing') {
                var nodes = optPath && optPath.length ? optPath : ancestorChain(rawTarget);
                var max = Math.min(nodes.length, 16);
                for (var j = 0; j < max; j++) {
                    var node = nodes[j];
                    if (node && node.nodeType === 1 && inferSendLikeControl(node)) {
                        return node;
                    }
                }
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
