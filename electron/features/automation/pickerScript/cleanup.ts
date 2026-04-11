/** Teardown + global cleanup registration. */
export function buildPickerCleanupBlock(): string {
  return `        const cleanup = () => {
            try {
                try { iframeObserver.disconnect(); } catch (e) { safePickerLog('cleanup.iframeObserver', e); }
                if (iframeScanRafId != null) {
                    try { safeCancelAnimationFrame(iframeScanRafId); } catch (e) { safePickerLog('cleanup.cancelIframeScan', e); }
                    iframeScanRafId = null;
                    scanIframesScheduled = false;
                }
                for (var i = 0; i < listenerRoots.length; i++) {
                    var rootDoc = listenerRoots[i];
                    try {
                        rootDoc.removeEventListener('mouseover', onMouseOver, true);
                        rootDoc.removeEventListener('mousemove', onMouseMove, true);
                        rootDoc.removeEventListener('mouseout', onMouseOut, true);
                        rootDoc.removeEventListener('click', onClick, true);
                        rootDoc.removeEventListener('beforeinput', onTypingDetected, true);
                        rootDoc.removeEventListener('input', onTypingDetected, true);
                        rootDoc.removeEventListener('keydown', onKeyDown, true);
                        if (rootDoc.documentElement) {
                            try { delete rootDoc.documentElement.__aiPickerListenersAttached; } catch (e) { safePickerLog('cleanup.listenerFlag', e); }
                        }
                    } catch (e) { safePickerLog('cleanup.listenerRoot', e); }
                }
                listenerRoots.length = 0;
                if (typingAdvanceTimer) {
                    clearTimeout(typingAdvanceTimer);
                    typingAdvanceTimer = null;
                }
                if (window._aiPickerRaf) {
                    safeCancelAnimationFrame(window._aiPickerRaf);
                    delete window._aiPickerRaf;
                }
                if (lastHovered) {
                    try {
                        lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                    } catch(e){ safePickerLog('cleanup.lastHoveredClass', e); }
                }
                if (selectedInputElement) {
                    try {
                        selectedInputElement.classList.remove('_ai-picker-selected');
                    } catch(e){ safePickerLog('cleanup.selectedInputClass', e); }
                }
                if (infoBox && infoBox.parentNode) infoBox.parentNode.removeChild(infoBox);
                if (labelBox && labelBox.parentNode) labelBox.parentNode.removeChild(labelBox);
                if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
                delete window._aiPickerCleanup;
            } catch (e) {
                safeConsole.error('Cleanup error', e);
            }
        };

        window._aiPickerCleanup = cleanup;
`
}
