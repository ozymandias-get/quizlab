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
        var iframeObservers = [];
        var scannedDocs = new Set();

        const scanDocumentForFrames = (doc) => {
            try {
                doc.querySelectorAll('iframe').forEach(function(iframe) {
                    var d = null;
                    try { d = iframe.contentDocument; } catch (err) { return; }
                    if (!d) return;
                    attachListeners(d);
                    if (!scannedDocs.has(d)) {
                        scannedDocs.add(d);
                        scanDocumentForFrames(d);
                    }
                });
            } catch (err) { safePickerLog('iframe.scan', err); }
        };
        const observeFrameDocuments = () => {
            for (var i = 0; i < listenerRoots.length; i++) {
                var doc = listenerRoots[i];
                if (doc === mainDoc) continue;
                if (!doc.documentElement || doc.documentElement.__aiPickerFrameObserved) continue;
                doc.documentElement.__aiPickerFrameObserved = true;
                try {
                    var obs = new MutationObserver(scheduleIframeScan);
                    obs.observe(doc.documentElement, { childList: true, subtree: true });
                    iframeObservers.push(obs);
                } catch (err) { safePickerLog('iframe.observe.doc', err); }
            }
        };
        const scanIframesImmediate = () => {
            try {
                scanDocumentForFrames(mainDoc);
                observeFrameDocuments();
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
