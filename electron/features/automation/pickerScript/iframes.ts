/** Multi-document listeners + iframe scan / observer. */
export function buildPickerIframesBlock(): string {
  return `        const listenerRoots = [];
        // Same-origin frames get their own copy of the picker stylesheet: the
        // host rules only exist in the top document, so a composer inside an
        // iframe used to receive the hover/selected classes without any CSS to
        // paint them. Entries are tracked so cleanup can remove the clones
        // (and the "already styled" flag) instead of leaving dead style nodes
        // behind in the frame document.
        var frameStyleEntries = [];
        const frameHasLiveStyle = (rootDoc) => {
            for (var s = 0; s < frameStyleEntries.length; s++) {
                var entry = frameStyleEntries[s];
                if (entry.doc === rootDoc && entry.el && entry.el.isConnected) return true;
            }
            return false;
        };
        // The "already styled" state is the LIVE node, not a flag on the root:
        // a frame that replaces its <head> keeps the same documentElement, so a
        // flag would suppress the re-injection and leave the frame unstyled.
        const ensureFrameStyles = (rootDoc) => {
            if (!rootDoc || rootDoc === mainDoc || !rootDoc.documentElement) return;
            if (frameHasLiveStyle(rootDoc)) return;
            if (!styleEl) return;
            try {
                var frameHead = rootDoc.head || rootDoc.documentElement;
                var clone = styleEl.cloneNode(true);
                clone.setAttribute('data-ai-picker-style', 'true');
                frameHead.appendChild(clone);
                frameStyleEntries.push({ doc: rootDoc, el: clone });
            } catch (err) { safePickerLog('iframe.styles', err); }
        };
        const refreshFrameStyles = () => {
            for (var i = 0; i < listenerRoots.length; i++) {
                var rootDoc = listenerRoots[i];
                if (rootDoc === mainDoc) continue;
                ensureFrameStyles(rootDoc);
            }
        };
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
            // Editors that handle their own key/composition/paste pipeline can
            // suppress or re-target the plain input event. These three are the
            // same "the user is typing" signal through other channels, and the
            // handler filters by containment, so an event from another field
            // still cannot advance the step.
            rootDoc.addEventListener('compositionend', onTypingDetected, true);
            rootDoc.addEventListener('paste', onTypingDetected, true);
            rootDoc.addEventListener('keyup', onTypingDetected, true);
            rootDoc.addEventListener('pointerdown', onControlPointerEvent, true);
            rootDoc.addEventListener('mousedown', onControlPointerEvent, true);
            rootDoc.addEventListener('pointerup', onControlPointerEvent, true);
            rootDoc.addEventListener('mouseup', onControlPointerEvent, true);
            rootDoc.addEventListener('keydown', onKeyDown, true);
            // Scroll does not bubble, but capture listeners on the document see
            // every descendant scroller; the window-level resize covers layout
            // shifts that move the hovered element.
            rootDoc.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
            try {
                var rootWin = rootDoc.defaultView;
                if (rootWin) rootWin.addEventListener('resize', onScrollOrResize, { passive: true });
            } catch (err) { safePickerLog('iframe.resizeListener', err); }
            listenerRoots.push(rootDoc);
            ensureFrameStyles(rootDoc);
        };

        var scanIframesScheduled = false;
        var iframeScanRafId = null;
        var iframeObservers = [];
        var frameObservers = [];
        var frameLoadWatches = [];
        var scannedDocs = new Set();

        // A same-origin frame's document is replaced when it navigates. No DOM
        // mutation fires in the parent for that, so without a \`load\` hook the
        // listeners stayed bound to the OLD document and hover/click inside the
        // new one was silently dead until some unrelated parent mutation
        // happened to schedule a rescan.
        const watchFrameLoad = (frame) => {
            if (!frame || frame.__aiPickerLoadWatched) return;
            frame.__aiPickerLoadWatched = true;
            var handler = function() { scheduleIframeScan(); };
            try {
                frame.addEventListener('load', handler);
                frameLoadWatches.push({ el: frame, handler: handler });
            } catch (err) { safePickerLog('iframe.loadWatch', err); }
        };

        const scanDocumentForFrames = (doc) => {
            try {
                doc.querySelectorAll('iframe, frame').forEach(function(iframe) {
                    watchFrameLoad(iframe);
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
                    frameObservers.push({ doc: doc, observer: obs });
                } catch (err) { safePickerLog('iframe.observe.doc', err); }
            }
        };
        // Detached or navigated-away frame documents keep their listeners and
        // their MutationObserver alive otherwise, so a long picker session on an
        // SPA that recreates frames would accumulate dead roots.
        const pruneDeadFrameRoots = () => {
            for (var l = listenerRoots.length - 1; l >= 0; l--) {
                var rootDoc = listenerRoots[l];
                if (rootDoc === mainDoc) continue;
                var alive = true;
                try { alive = rootDoc.defaultView != null; } catch (err) { alive = false; }
                if (!alive) listenerRoots.splice(l, 1);
            }
            for (var o = frameObservers.length - 1; o >= 0; o--) {
                var entry = frameObservers[o];
                var entryAlive = true;
                try { entryAlive = entry.doc.defaultView != null; } catch (err) { entryAlive = false; }
                if (entryAlive) continue;
                try { entry.observer.disconnect(); } catch (err) { safePickerLog('iframe.disconnectDead', err); }
                frameObservers.splice(o, 1);
                var observerIndex = iframeObservers.indexOf(entry.observer);
                if (observerIndex >= 0) iframeObservers.splice(observerIndex, 1);
            }
            // The scanned-docs set is the other strong reference to a dead
            // document; keeping it would defeat the pruning above.
            scannedDocs.forEach(function(scanned) {
                var scannedAlive = true;
                try { scannedAlive = scanned.defaultView != null; } catch (err) { scannedAlive = false; }
                if (!scannedAlive) scannedDocs.delete(scanned);
            });
        };
        const scanIframesImmediate = () => {
            try {
                pruneDeadFrameRoots();
                scanDocumentForFrames(mainDoc);
                observeFrameDocuments();
                refreshFrameStyles();
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
