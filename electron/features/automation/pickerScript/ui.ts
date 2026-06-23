/** Trusted types, mainDoc, rAF, overlay boxes, mount, stylesheet. */
export function buildPickerUiBlock(pickerStyles: string): string {
  return `        let ttPolicy = { createHTML: s => s, createScript: s => s };
        if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
            try {
                // The browser limits how many Trusted Types policies a
                // single document can register (~30 in Chromium) and logs
                // "more functions defined than expected" each time a new
                // policy is added past the cap. Re-use a stable policy
                // name across picker sessions so repeat invocations don't
                // exhaust the budget and produce noisy warnings.
                const STABLE_POLICY_NAME = 'ai-picker-ext';
                const existing = trustedTypes.getPolicyNames
                    ? trustedTypes.getPolicyNames().indexOf(STABLE_POLICY_NAME) >= 0
                    : false;
                if (existing) {
                    ttPolicy = trustedTypes.getPolicy(STABLE_POLICY_NAME);
                } else {
                    ttPolicy = trustedTypes.createPolicy(STABLE_POLICY_NAME, {
                        createHTML: s => s,
                        createScript: s => s
                    });
                }
            } catch (e) { safePickerLog('trustedTypes.createPolicy', e); }
        }

        const mainDoc = document;
        const safeRequestAnimationFrame =
            (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
                ? window.requestAnimationFrame.bind(window)
                : function(callback) { return setTimeout(callback, 16); };
        const safeCancelAnimationFrame =
            (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function')
                ? window.cancelAnimationFrame.bind(window)
                : function(id) { clearTimeout(id); };
        let styleEl = null;

        const infoBox = mainDoc.createElement('div');
        Object.assign(infoBox.style, {
            position: 'fixed', top: '20px', left: '20px', 
            width: '320px', padding: '16px',
            background: 'linear-gradient(145deg, rgba(15, 15, 25, 0.95), rgba(5, 5, 15, 0.95))', 
            color: 'white', borderRadius: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px',
            zIndex: '2147483647', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)',
            pointerEvents: 'none', userSelect: 'none', transition: 'all 0.3s ease'
        });

        const updateInfoBox = (hoveredInfo) => {
            try {
                const { html: stepHtml, color: statusColor } = getStepHtml(step, TRANSLATIONS);
                const hintHtml = getHintHtml(step, hoveredInfo, TRANSLATIONS);
                
                try {
                    infoBox.innerHTML = ttPolicy.createHTML(stepHtml + hintHtml);
                } catch(e) {
                    safePickerLog('ui.trustedHtml', e);
                    infoBox.innerHTML = stepHtml + hintHtml;
                }
                infoBox.style.borderTop = '3px solid ' + statusColor;
                
                if (step === 'typing') {
                    const nextBtn = mainDoc.getElementById('_ai_picker_next_btn');
                    if (nextBtn) {
                        nextBtn.onclick = function(e) {
                            e.stopPropagation();
                            step = 'submit';
                            updateInfoBox(null);
                        };
                    }
                }
            } catch (e) {
                safeConsole.error('Helper UI update error', e);
            }
        };

        const labelBox = mainDoc.createElement('div');
        Object.assign(labelBox.style, {
            position: 'fixed', padding: '6px 10px', 
            background: 'rgba(0,0,0,0.85)', 
            color: 'white', borderRadius: '6px', fontSize: '11px', fontWeight: '500', 
            pointerEvents: 'none', zIndex: '2147483647', display: 'none', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: '200px', whiteSpace: 'nowrap'
        });

        var uiMounted = false;
        const mountPickerUi = () => {
            if (uiMounted || !mainDoc.body) return;
            if (!infoBox.parentNode) mainDoc.body.appendChild(infoBox);
            if (!labelBox.parentNode) mainDoc.body.appendChild(labelBox);
            uiMounted = true;
            updateInfoBox(null);
        };
        if (mainDoc.body) {
            mountPickerUi();
        } else {
            mainDoc.addEventListener('DOMContentLoaded', mountPickerUi, { once: true });
        }

        // S2: SPA frameworks (Next, Nuxt, React Router) sometimes swap
        // \`document.body\` wholesale. When that happens our infoBox /
        // labelBox / styleEl are detached and the picker becomes invisible.
        // Watch the \`<html>\` root and re-mount on the new body if needed.
        var bodyObserver = null;
        try {
            bodyObserver = new MutationObserver(() => {
                if (!uiMounted) {
                    if (mainDoc.body) mountPickerUi();
                    return;
                }
                // Re-attach if the box got orphaned (parentNode gone or
                // moved under a node that isn't the current body).
                if (infoBox && (!infoBox.parentNode || infoBox.parentNode !== mainDoc.body)) {
                    if (mainDoc.body) {
                        mainDoc.body.appendChild(infoBox);
                        mainDoc.body.appendChild(labelBox);
                        updateInfoBox(null);
                    }
                }
            });
            if (mainDoc.documentElement) {
                bodyObserver.observe(mainDoc.documentElement, { childList: true, subtree: false });
            }
        } catch (err) { safePickerLog('ui.bodyObserver', err); }

        try {
            styleEl = mainDoc.createElement('style');
            try {
                styleEl.textContent = ttPolicy.createHTML(\`${pickerStyles}\`);
            } catch(e) {
                safePickerLog('ui.trustedStyle', e);
                styleEl.textContent = \`${pickerStyles}\`;
            }
            if (mainDoc.head) mainDoc.head.appendChild(styleEl);
        } catch(e) {
            safeConsole.error('Style injection failed', e);
        }

        let lastHovered = null;
`
}
