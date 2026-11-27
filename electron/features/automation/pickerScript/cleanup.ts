/** Teardown + global cleanup registration. */
export function buildPickerCleanupBlock(): string {
  return `        const cleanup = () => {
            try {
                try { iframeObserver.disconnect(); } catch (e) { safePickerLog('cleanup.iframeObserver', e); }
                try { bodyObserver && bodyObserver.disconnect(); } catch (e) { safePickerLog('cleanup.bodyObserver', e); }
                for (var f = 0; f < iframeObservers.length; f++) {
                    try { iframeObservers[f].disconnect(); } catch (e) { safePickerLog('cleanup.iframeDocObserver', e); }
                }
                iframeObservers.length = 0;
                frameObservers.length = 0;
                for (var w = 0; w < frameLoadWatches.length; w++) {
                    try {
                        var watch = frameLoadWatches[w];
                        if (watch && watch.el) {
                            watch.el.removeEventListener('load', watch.handler);
                            try { delete watch.el.__aiPickerLoadWatched; } catch (e) { safePickerLog('cleanup.frameLoadFlag', e); }
                        }
                    } catch (e) { safePickerLog('cleanup.frameLoadWatch', e); }
                }
                frameLoadWatches.length = 0;
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
                        rootDoc.removeEventListener('scroll', onScrollOrResize, true);
                        try {
                            var rootWindow = rootDoc.defaultView;
                            if (rootWindow) rootWindow.removeEventListener('resize', onScrollOrResize);
                        } catch (e) { safePickerLog('cleanup.resizeListener', e); }
                        if (rootDoc.documentElement) {
                            try { delete rootDoc.documentElement.__aiPickerListenersAttached; } catch (e) { safePickerLog('cleanup.listenerFlag', e); }
                            try { delete rootDoc.documentElement.__aiPickerFrameObserved; } catch (e) { safePickerLog('cleanup.frameFlag', e); }
                        }
                    } catch (e) { safePickerLog('cleanup.listenerRoot', e); }
                }
                listenerRoots.length = 0;
                // Frame stylesheet clones live in other documents; removing the
                // top-document styleEl alone would leave them applied.
                for (var s = 0; s < frameStyleEntries.length; s++) {
                    try {
                        var styleEntry = frameStyleEntries[s];
                        if (styleEntry.el && styleEntry.el.parentNode) styleEntry.el.parentNode.removeChild(styleEntry.el);
                    } catch (e) { safePickerLog('cleanup.frameStyle', e); }
                }
                frameStyleEntries.length = 0;
                if (typingAdvanceTimer) {
                    clearTimeout(typingAdvanceTimer);
                    typingAdvanceTimer = null;
                }
                if (window._aiPickerRaf) {
                    safeCancelAnimationFrame(window._aiPickerRaf);
                    delete window._aiPickerRaf;
                }
                // S4 + C2: drain every scheduled timer we own so a late
                // post-save callback cannot mutate the DOM or the class
                // list after teardown.
                try { cancelPendingTimers(); } catch (e) { safePickerLog('cleanup.cancelTimers', e); }
                try { restoreAllFlashes(); } catch (e) { safePickerLog('cleanup.restoreFlashes', e); }
                if (lastHovered) {
                    try {
                        lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                    } catch(e){ safePickerLog('cleanup.lastHoveredClass', e); }
                    lastHovered = null;
                }
                if (selectedInputElement) {
                    try {
                        selectedInputElement.classList.remove('_ai-picker-selected');
                    } catch(e){ safePickerLog('cleanup.selectedInputClass', e); }
                    selectedInputElement = null;
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
