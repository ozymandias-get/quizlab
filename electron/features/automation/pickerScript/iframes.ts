/** Multi-document listeners + iframe scan / observer. */
export function buildPickerIframesBlock(): string {
  return `        const listenerRoots = [];
        const attachListeners = (rootDoc) => {
            if (!rootDoc || !rootDoc.documentElement) return;
            if (rootDoc.documentElement.__aiPickerListenersAttached) return;
            rootDoc.documentElement.__aiPickerListenersAttached = true;
            rootDoc.addEventListener('mouseover', onMouseOver, true);
            rootDoc.addEventListener('mousemove', onMouseMove, true);
            rootDoc.addEventListener('mouseout', onMouseOut, true);
            rootDoc.addEventListener('click', onClick, true);
            rootDoc.addEventListener('beforeinput', onTypingDetected, true);
            rootDoc.addEventListener('input', onTypingDetected, true);
            rootDoc.addEventListener('keydown', onKeyDown, true);
            listenerRoots.push(rootDoc);
        };

        var scanIframesScheduled = false;
        var iframeScanRafId = null;
        const scanIframesImmediate = () => {
            try {
                mainDoc.querySelectorAll('iframe').forEach(function(iframe) {
                    try {
                        var d = iframe.contentDocument;
                        if (d) attachListeners(d);
                    } catch (err) { ignoreDomAccessError(err); }
                });
            } catch (err) { safePickerLog('iframe.scan', err); }
        };
        const scheduleIframeScan = () => {
            if (scanIframesScheduled) return;
            scanIframesScheduled = true;
            iframeScanRafId = safeRequestAnimationFrame(function() {
                iframeScanRafId = null;
                scanIframesScheduled = false;
                scanIframesImmediate();
            });
        };

        attachListeners(mainDoc);
        scanIframesImmediate();
        var iframeObserver = new MutationObserver(scheduleIframeScan);
        try {
            iframeObserver.observe(mainDoc.documentElement, { childList: true, subtree: true });
        } catch (err) { safePickerLog('iframe.observe', err); }
`
}
