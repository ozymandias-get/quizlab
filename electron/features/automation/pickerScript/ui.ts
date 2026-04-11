/** Trusted types, mainDoc, rAF, overlay boxes, mount, stylesheet. */
export function buildPickerUiBlock(pickerStyles: string): string {
  return `        let ttPolicy = { createHTML: s => s, createScript: s => s };
        if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
            try {
                ttPolicy = trustedTypes.createPolicy('ai-picker-ext-' + Date.now(), { 
                    createHTML: s => s, 
                    createScript: s => s 
                });
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
