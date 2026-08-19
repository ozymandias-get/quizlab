/**
 * Closed Shadow Root Registry runtime.
 *
 * Closed shadow roots (`attachShadow({ mode: 'closed' })`) are unreachable via
 * `element.shadowRoot` and invisible to `document.querySelector`. Third-party
 * widgets and security wrappers use them heavily, which makes selector-based
 * automation (model pickers, file upload buttons, new-chat triggers) fail with
 * SELECTOR_NOT_FOUND.
 *
 * We monkey-patch `Element.prototype.attachShadow` so every shadow root that is
 * ever created (open OR closed) is recorded in a host → root WeakMap. Search
 * helpers can then resolve the root of ANY host element they encounter while
 * walking the DOM tree — even when the host deliberately hides it. Weak keys
 * let the browser GC the entries when hosts are removed, so the page does not
 * leak memory as components mount/unmount.
 *
 * The patch is installed once per page (`window.__quizlabShadowHookInstalled`).
 * It only appends bookkeeping — it never alters the returned root or the
 * created tree, so existing page behaviour is preserved.
 */
export const shadowRootRegistryRuntime = `    const __installShadowRootRegistry = () => {
        if (typeof window === 'undefined') return null;
        if (window.__quizlabShadowHosts) return window.__quizlabShadowHosts;
        try {
            const hosts = new WeakMap();
            window.__quizlabShadowHosts = hosts;
            if (typeof Element === 'function' && typeof Element.prototype.attachShadow === 'function' && !window.__quizlabShadowHookInstalled) {
                window.__quizlabShadowHookInstalled = true;
                const originalAttachShadow = Element.prototype.attachShadow;
                Element.prototype.attachShadow = function attachShadow(init) {
                    const root = originalAttachShadow.call(this, init);
                    try { hosts.set(this, root); } catch (_) {}
                    return root;
                };
            }
            return hosts;
        } catch (_) {
            return null;
        }
    };

    const getShadowRootForHost = (host) => {
        try {
            if (host && host.shadowRoot) return host.shadowRoot;
            const hosts = window.__quizlabShadowHosts;
            if (hosts && typeof hosts.get === 'function' && host) return hosts.get(host) || null;
        } catch (_) {}
        return null;
    };
`
