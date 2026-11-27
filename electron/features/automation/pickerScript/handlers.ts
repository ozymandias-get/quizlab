/** Pointer / click / keyboard / typing-advance handlers. */
export function buildPickerHandlersBlock(): string {
  return `        // C2: 500ms+300ms nested setTimeouts used to race against
        // renderer-side \`stopPicker()\` (which called CLEANUP first and
        // orphaned the still-pending teardown closures). Track every timer
        // we schedule so cleanup can drain them deterministically.
        var pendingTimers = new Set();
        const scheduleTimer = (fn, ms) => {
            const id = setTimeout(() => {
                pendingTimers.delete(id);
                try { fn(); } catch (e) { safePickerLog('timer.callback', e); }
            }, ms);
            pendingTimers.add(id);
            return id;
        };
        const cancelPendingTimers = () => {
            for (var t of pendingTimers) {
                try { clearTimeout(t); } catch (e) { safePickerLog('timer.clear', e); }
            }
            pendingTimers.clear();
        };

        // Inline feedback belongs to the picker: restore the site's values
        // both when a flash expires and when teardown cancels its timer.
        const activeFlashes = new Map();
        const restoreFlash = (target) => {
            const flash = activeFlashes.get(target);
            if (!flash) return;
            clearTimeout(flash.timer);
            pendingTimers.delete(flash.timer);
            for (const property of ['transition', 'box-shadow']) {
                const original = flash.properties[property];
                if (original.value) target.style.setProperty(property, original.value, original.priority);
                else target.style.removeProperty(property);
            }
            activeFlashes.delete(target);
        };
        const flashTarget = (target, transition, shadow, duration) => {
            let flash = activeFlashes.get(target);
            if (flash) {
                clearTimeout(flash.timer);
                pendingTimers.delete(flash.timer);
            } else {
                const properties = {};
                for (const property of ['transition', 'box-shadow']) {
                    properties[property] = {
                        value: target.style.getPropertyValue(property),
                        priority: target.style.getPropertyPriority(property)
                    };
                }
                flash = { properties, timer: null };
                activeFlashes.set(target, flash);
            }
            target.style.setProperty('transition', transition);
            target.style.setProperty('box-shadow', shadow);
            flash.timer = scheduleTimer(() => restoreFlash(target), duration);
        };
        const restoreAllFlashes = () => {
            for (const target of activeFlashes.keys()) restoreFlash(target);
        };

        // S10: per-element info memoization. \`getElementInfo\` is called
        // twice per hover (once for category, once for label) and again
        // on click — cache by element identity so a stationary hover
        // doesn't recompute on every mousemove.
        const elementInfoCache = new WeakMap();
        const memoGetElementInfo = (el) => {
            if (!el) return null;
            const cached = elementInfoCache.get(el);
            if (cached) return cached;
            const info = getElementInfo(el);
            elementInfoCache.set(el, info);
            return info;
        };

        const isPickerUiNode = (node) => {
            try {
                return !!(node && node.nodeType === 1 && typeof node.closest === 'function' &&
                    node.closest('[data-ai-picker-ui="true"]'));
            } catch (e) { return false; }
        };

        // Pointer position per document. Scroll and resize move the element
        // under a STATIONARY pointer without firing pointer events, so the last
        // known position is the only way to ask the document what the cursor is
        // over after layout changed.
        const pointerByDoc = new WeakMap();
        const rememberPointer = (e) => {
            try {
                var doc = (e && e.view && e.view.document) || mainDoc;
                pointerByDoc.set(doc, { x: e.clientX, y: e.clientY });
            } catch (err) { safePickerLog('pointer.remember', err); }
        };

        // Paint hover state for one element. Shared by pointer hover and by the
        // layout re-resolution below, so both paths classify and update alike.
        const paintHover = (rawTarget, optPath, clientX, clientY) => {
            if (isPickerUiNode(rawTarget)) return false;
            const target = normalizeTarget(rawTarget, optPath);
            if (!target) return false;

            if (lastHovered !== target) {
                // I5: detect detached lastHovered (page mutation can rip the
                // previously hovered node out of the DOM between mouse events).
                // Logging helps diagnose "hover stuck on ghost" bugs.
                if (lastHovered && !lastHovered.isConnected) {
                    safePickerLog('hover.detached', lastHovered);
                }

                if (lastHovered && lastHovered !== selectedInputElement) {
                    try {
                        lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                    } catch (err) { safePickerLog('hover.clearPrev', err); }
                }

                lastHovered = target;

                const info = memoGetElementInfo(target);

                // Target-integrity invariant: green must mean "acceptable for
                // THIS step". A high-confidence element of the wrong category
                // (e.g. a send button while picking the input) must never be
                // painted as a good choice — the user reads green as "correct".
                const isGoodChoice = (step === 'input' && info.category === 'input') ||
                                    (step === 'submit' && info.category === 'button');
                const isMediumChoice = (step === 'input' && target.isContentEditable) ||
                                    (step === 'submit' && (info.category === 'container' || info.tag === 'a'));

                let cls;
                let labelBg;
                if (isGoodChoice) {
                    cls = '_ai-picker-hover-good';
                    labelBg = '#22c55e';
                } else if (isMediumChoice || info.confidence === 'medium') {
                    cls = '_ai-picker-hover-medium';
                    labelBg = '#f59e0b';
                } else {
                    cls = '_ai-picker-hover-low';
                    labelBg = '#ef4444';
                }

                if (target !== selectedInputElement) {
                    target.classList.add(cls);
                }

                const labelText = (info.labelKey && TRANSLATIONS[info.labelKey]) ? TRANSLATIONS[info.labelKey] : info.labelEN;
                labelBox.textContent = labelText;
                labelBox.style.background = labelBg;
                updateInfoBox(info);
            }

            labelBox.style.display = 'block';
            positionLabelBox(clientX, clientY);
            return true;
        };

        const onMouseOver = (e) => {
            if (step !== 'input' && step !== 'submit') return;
            e.stopPropagation();
            try {
                rememberPointer(e);
                var ctx = getEventContext(e);
                paintHover(ctx.rawTarget, ctx.path, e.clientX, e.clientY);
            } catch (err) {
                safePickerLog('hover.update', err);
            }
        };

        const onMouseMove = (e) => {
            rememberPointer(e);
            if (labelBox.style.display !== 'block') return;

            if (window._aiPickerRaf) safeCancelAnimationFrame(window._aiPickerRaf);

            var moveX = e.clientX;
            var moveY = e.clientY;
            window._aiPickerRaf = safeRequestAnimationFrame(() => {
                positionLabelBox(moveX, moveY);
            });
        };

        const positionLabelBox = (clientX, clientY) => {
            const offsetX = 15;
            const offsetY = 20;
            const margin = 8;
            const maxLeft = window.innerWidth - labelBox.offsetWidth - margin;
            const maxTop = window.innerHeight - labelBox.offsetHeight - margin;
            const left = Math.min(Math.max(clientX + offsetX, margin), Math.max(margin, maxLeft));
            const top = Math.min(Math.max(clientY + offsetY, margin), Math.max(margin, maxTop));
            labelBox.style.left = left + 'px';
            labelBox.style.top = top + 'px';
        };
        
        const onMouseOut = (e) => {
            if (step === 'typing') return;
            if (window._aiPickerRaf) safeCancelAnimationFrame(window._aiPickerRaf);
            labelBox.style.display = 'none';

            // Hover styling must not outlive the hover. Without this, leaving
            // the page (or moving onto the picker chrome) left the last
            // element outlined green/red until cleanup -- a stale visual that
            // also survived body re-renders on SPA hosts.
            if (!lastHovered) return;
            var related = e && e.relatedTarget;
            try {
                // Moving between descendants of the same hovered element is
                // not a real exit: keep the outline (no flicker).
                if (
                    related &&
                    (related === lastHovered ||
                        (typeof lastHovered.contains === 'function' &&
                            lastHovered.contains(related)))
                ) {
                    return;
                }
            } catch (relatedErr) { safePickerLog('mouseout.related', relatedErr); }
            if (lastHovered !== selectedInputElement) {
                try {
                    lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                } catch (err) { safePickerLog('mouseout.clearHover', err); }
            }
            // Reset so re-entering the same element re-applies the outline.
            lastHovered = null;
        };

        // Remove the hover outline and the floating label. Used when layout
        // movement leaves nothing hoverable under the pointer.
        const clearHoverPainting = () => {
            labelBox.style.display = 'none';
            if (lastHovered && lastHovered !== selectedInputElement) {
                try {
                    lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                } catch (err) { safePickerLog('scroll.clearHover', err); }
            }
            lastHovered = null;
        };

        // Scroll and resize move the element under a stationary pointer without
        // firing pointer events. Rather than blanking the picker until the user
        // happens to move the mouse (which reads as "nothing is selectable"
        // right after scrolling to the composer), hit-test the last pointer
        // position and repaint whatever is under it now. Only a changed target
        // rebuilds the info panel, so a scroll frame that keeps the same
        // element stays cheap. Documents without elementFromPoint (tests, rare
        // embeddings) keep the old clear-on-layout-change behaviour.
        const onScrollOrResize = (e) => {
            if (window._aiPickerRaf) safeCancelAnimationFrame(window._aiPickerRaf);
            if (step !== 'input' && step !== 'submit') {
                clearHoverPainting();
                return;
            }

            var doc = mainDoc;
            try {
                var layoutTarget = e && e.currentTarget;
                if (layoutTarget && layoutTarget.document) doc = layoutTarget.document;
                else if (layoutTarget && layoutTarget.nodeType === 9) doc = layoutTarget;
                else if (e && e.view && e.view.document) doc = e.view.document;
            } catch (docErr) { safePickerLog('layout.doc', docErr); }

            var pointer = pointerByDoc.get(doc);
            var under = pointer ? deepElementFromPoint(doc, pointer.x, pointer.y) : null;
            if (!under || isPickerUiNode(under)) {
                clearHoverPainting();
                return;
            }
            try {
                if (!paintHover(under, null, pointer.x, pointer.y)) {
                    clearHoverPainting();
                }
            } catch (err) {
                safePickerLog('layout.repaint', err);
                clearHoverPainting();
            }
        };

        // Focus a picked text control deterministically. A bare focus() on a
        // contenteditable does not place a caret, so editors that require an
        // explicit DOM selection (ProseMirror/Lexical) can drop the first
        // keystroke; collapsing the caret to the end also continues a draft
        // instead of overwriting it.
        const focusTextEntry = (el) => {
            if (!el) return;
            try {
                var editable = findTextEntryControl(el) || el;
                if (typeof editable.focus === 'function') editable.focus();
                var doc = editable.ownerDocument || mainDoc;
                if (editable.isContentEditable && typeof doc.createRange === 'function') {
                    var selection = doc.getSelection ? doc.getSelection() : null;
                    if (selection) {
                        var range = doc.createRange();
                        range.selectNodeContents(editable);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
                var active = deepActiveElement(doc);
                if (active && active !== editable) {
                    safePickerLog('input.focusNotApplied', editable);
                }
            } catch (focusErr) {
                safePickerLog('input.focus', focusErr);
            }
        };

        // The panels are pointer-events:none so they never block the page, but
        // that also means a click on their visible surface is delivered to the
        // element underneath. Swallow clicks inside the info panel rect: the
        // user is aiming at the picker chrome, not at a page control hidden
        // below it. The small hover label is deliberately excluded — it tracks
        // the pointer and must never eat the click the user is about to make.
        // Zero-sized rects are skipped (element not laid out yet).
        const isPointInPickerUi = (clientX, clientY) => {
            var box = infoBox;
            if (!box || box.style.display === 'none' || typeof box.getBoundingClientRect !== 'function') return false;
            try {
                var rect = box.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return false;
                return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
            } catch (rectErr) {
                safePickerLog('ui.rect', rectErr);
                return false;
            }
        };

        // Resolve the clicked element. A site can replace the composer node in
        // response to mousedown (hydration, focus handlers, SPA re-render), so
        // the click event's own target can already be detached by the time the
        // handler runs. Re-hit-test the pointer instead of rejecting a click the
        // user made on the live node that now occupies that spot.
        const resolveClickTarget = (ctx, e) => {
            var target = normalizeTarget(ctx.rawTarget, ctx.path);
            if (target && target.isConnected !== false) return target;
            var hasPointer = !!(e && typeof e.clientX === 'number' && typeof e.clientY === 'number' &&
                (e.clientX !== 0 || e.clientY !== 0));
            if (!hasPointer) return target;
            var under = deepElementFromPoint(mainDoc, e.clientX, e.clientY);
            if (!under) return target;
            return normalizeTarget(under, null) || target;
        };

        // Persist an input pick and move to step 2. Shared by the input step and
        // by the re-bind path that recovers when the site swapped the composer.
        const commitInputSelection = (target) => {
            var locatorBundle = null;
            try {
                locatorBundle = generateLocatorBundle(target, 'input');
            } catch (err) {
                safeConsole.error('Selector generation failed', err);
                return false;
            }
            if (!locatorBundle || !locatorBundle.fingerprint || !locatorBundle.primarySelector) {
                safeConsole.error('Locator bundle generation returned empty result');
                try {
                    flashTarget(target, 'all 0.2s ease', '0 0 25px #ef4444', 200);
                } catch (flashErr) { safePickerLog('click.emptyFlash', flashErr); }
                return false;
            }
            try {
                flashTarget(target, 'all 0.3s ease', '0 0 30px #60a5fa', 300);
            } catch (err) { safePickerLog('click.flash', err); }

            selectionData.input = locatorBundle.primarySelector;
            selectionData.waitFor = locatorBundle.primarySelector;
            selectionData.inputCandidates = locatorBundle.candidates || [];
            selectionData.inputFingerprint = locatorBundle.fingerprint;
            selectedInputElement = target;
            try {
                target.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                target.classList.add('_ai-picker-selected');
            } catch (classErr) { safePickerLog('input.selectedClass', classErr); }
            step = 'typing';
            labelBox.style.display = 'none';
            updateInfoBox(null);
            focusTextEntry(target);
            return true;
        };

        // Sites can act on pointer/mouse DOWN or UP instead of click (the
        // ChatGPT composer sends a message on the pointer sequence even when
        // the click's default is prevented). While the picker is open, those
        // events must not reach a control the user is only trying to pick —
        // otherwise step 3 sends the draft and the page navigates away
        // mid-pick. Text-entry targets are deliberately left alone so the
        // native focus/caret (and our own selection) still work.
        const onControlPointerEvent = (e) => {
            if (step === 'done') return;
            try {
                var pointerCtx = getEventContext(e);
                var rawControlTarget = pointerCtx.rawTarget;
                if (isPickerUiNode(rawControlTarget)) return;
                var controlTarget = normalizeTarget(rawControlTarget, pointerCtx.path);
                if (!controlTarget) return;
                if (!isButtonLikeNode(controlTarget) && !inferSendLikeControl(controlTarget)) return;
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
            } catch (pointerErr) {
                safePickerLog('pointer.block', pointerErr);
            }
        };

        const onClick = (e) => {
            if (step === 'done') return;
            
            e.preventDefault();
            e.stopPropagation();

            var clickCtx = getEventContext(e);
            if (clickCtx.rawTarget && typeof clickCtx.rawTarget.closest === 'function') {
                if (step === 'typing' && clickCtx.rawTarget.closest('#_ai_picker_next_btn')) {
                    if (typingAdvanceTimer) {
                        clearTimeout(typingAdvanceTimer);
                        pendingTimers.delete(typingAdvanceTimer);
                        typingAdvanceTimer = null;
                    }
                    step = 'submit';
                    updateInfoBox(null);
                    return;
                }
                if (clickCtx.rawTarget.closest('[data-ai-picker-ui="true"]')) {
                    return;
                }
            }

            if (isPointInPickerUi(e.clientX, e.clientY)) {
                return;
            }

            const target = resolveClickTarget(clickCtx, e);
            if (!target) return;

            if (step === 'typing') {
                if (target.id === '_ai_picker_next_btn') {
                    if (typingAdvanceTimer) {
                        clearTimeout(typingAdvanceTimer);
                        pendingTimers.delete(typingAdvanceTimer);
                        typingAdvanceTimer = null;
                    }
                    step = 'submit';
                    updateInfoBox(null);
                    return;
                }

                const isSelectedInputOrChild =
                    selectedInputElement &&
                    (target === selectedInputElement ||
                        (Array.isArray(clickCtx.path) && clickCtx.path.indexOf(selectedInputElement) >= 0) ||
                        (selectedInputElement.isConnected &&
                            typeof selectedInputElement.contains === 'function' &&
                            selectedInputElement.contains(target)));
                if (isSelectedInputOrChild) {
                    focusTextEntry(selectedInputElement);
                    return;
                }

                const targetInfo = memoGetElementInfo(target);
                if (
                    (!selectedInputElement || selectedInputElement.isConnected === false) &&
                    targetInfo &&
                    targetInfo.category === 'input'
                ) {
                    // The site replaced the composer node after it was picked
                    // (focus-time hydration, SPA re-render). The old node is
                    // detached, so containment can never match again and every
                    // click on the live composer would flash red. Re-bind to the
                    // node the user is typing in now.
                    safePickerLog('typing.rebind', target);
                    commitInputSelection(target);
                    return;
                }
                if (targetInfo.category === 'button') {
                    if (typingAdvanceTimer) {
                        clearTimeout(typingAdvanceTimer);
                        pendingTimers.delete(typingAdvanceTimer);
                        typingAdvanceTimer = null;
                    }
                    step = 'submit';
                    updateInfoBox(null);
                } else {
                    // S7: wrong target visual feedback — flash the rejected
                    // node red so the user understands why nothing happened.
                    try {
                        flashTarget(target, 'all 0.2s ease', '0 0 25px #ef4444', 200);
                    } catch (err) { safePickerLog('click.wrongFlash', err); }
                    return;
                }
            }

            // Target-integrity gate: the click target must be functionally valid
            // for the CURRENT step. Without this, a button clicked during the
            // input step (or an input clicked during the submit step) was
            // silently persisted as the wrong locator, and automation later
            // acted on the wrong element. Detached nodes (React re-render /
            // route change between hover and click) are rejected the same way.
            // Icon-only but genuine send buttons still pass: normalizeTarget
            // already elevates icon/span clicks to their button ancestor, and
            // getElementInfo classifies real buttons as category 'button'
            // regardless of their visible text.
            var clickInfo = memoGetElementInfo(target);
            var expectedCategory = step === 'input' ? 'input' : (step === 'submit' ? 'button' : null);
            if (expectedCategory && (!clickInfo || clickInfo.category !== expectedCategory || target.isConnected === false)) {
                try {
                    flashTarget(target, 'all 0.2s ease', '0 0 25px #ef4444', 200);
                } catch (err) { safePickerLog('click.wrongFlash', err); }
                return;
            }

            if (step === 'input') {
                commitInputSelection(target);
                return;
            }

            // Step 'submit': persist the send button. The input branch shares
            // the same locator/flash contract through commitInputSelection.
            let locatorBundle = null;
            try {
                locatorBundle = generateLocatorBundle(target, 'button');
            } catch (err) {
                safeConsole.error('Selector generation failed', err);
                return;
            }

            if (!locatorBundle || !locatorBundle.fingerprint || !locatorBundle.primarySelector) {
                safeConsole.error('Locator bundle generation returned empty result');
                try {
                    flashTarget(target, 'all 0.2s ease', '0 0 25px #ef4444', 200);
                } catch (err) { safePickerLog('click.emptyFlash', err); }
                return;
            }

            // S4: track every flash timer so cleanup drains it. Without this
            // the 300ms timer could fire AFTER cleanup removed the selected
            // class, leaving a stale box-shadow on the host.
            try {
                flashTarget(target, 'all 0.3s ease', '0 0 30px #4ade80', 300);
            } catch (err) {
                safePickerLog('click.flash', err);
            }

            if (step === 'submit') {
                try {
                    selectionData.button = locatorBundle.primarySelector;
                    selectionData.buttonCandidates = locatorBundle.candidates || [];
                    selectionData.buttonFingerprint = locatorBundle.fingerprint;
                    step = 'done';
                    
                    target.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                    labelBox.style.display = 'none';
                    updateInfoBox(null);
                    
                    scheduleTimer(() => {
                        try {
                            // I7: \`selectedInputElement\` can be detached by
                            // now (React re-renders, route changes, etc.).
                            // Only mutate the class if the node is still
                            // connected — otherwise log and skip.
                            if (selectedInputElement) {
                                if (selectedInputElement.isConnected) {
                                    selectedInputElement.classList.remove('_ai-picker-selected');
                                } else {
                                    safePickerLog('submit.selectedInputDetached', selectedInputElement);
                                }
                            }
                        } catch (e) { safePickerLog('submit.selectedInputClass', e); }


                        safePickerLog('submit.result', selectionData);
                        const resultJson = JSON.stringify(selectionData);
                        window._aiPickerResult = JSON.parse(resultJson);
                        try {
                            delete window.__quizlabReaderAutomationCache;
                        } catch (_) {}

                        // Bridge wiring: the renderer-side \`usePickerConsoleBridge\`
                        // listens for \`console-message\` events from the
                        // managed view and routes messages that start with
                        // \`_aiPicker:\` to the picker callbacks. Without
                        // this emit, the bridge would never fire
                        // \`onResult\` and the picker would never auto-close
                        // (the user reported the picker "stays open" after
                        // a successful selection — root cause was this
                        // missing emit, not the timer race).
                        try {
                            // Session-bound emit: the renderer bridge only
                            // accepts results carrying the current session id,
                            // so a delayed emit from an older session is
                            // ignored instead of overwriting the new pick.
                            var resultPrefix = __aiPickerSessionId
                                ? '_aiPicker:result:' + __aiPickerSessionId + ':'
                                : '_aiPicker:result:';
                            (window.console && window.console.log
                                ? window.console.log.bind(window.console)
                                : function () {}
                            )(resultPrefix + resultJson);
                        } catch (e) { safePickerLog('submit.consoleEmit', e); }

                        // 300ms beat: let the "done" UI render, then the
                        // renderer's stopPicker() takes over the rest of
                        // the teardown (and the cancellation message
                        // propagates back through the bridge).
                        scheduleTimer(() => {
                            // Only emit success if we haven't been
                            // cancelled in the meantime.
                            if (window._aiPickerCancelled) return;
                            if (window._aiPickerCleanup) window._aiPickerCleanup();
                        }, 300);
                    }, 500);
                } catch (err) {
                    safeConsole.error('Submit step error', err);
                    cleanup();
                }
            }
        };

        // C3: the picker hijacks the page, so any key the user presses
        // outside the selected input must not leak to the host AI site
        // (Tab → dev tools, Enter → form submit, Cmd+K → host shortcuts).
        // We swallow all keys by default with preventDefault + stopPropagation.
        //
        // CRITICAL EXCEPTION: once the user has selected an input element
        // (\`selectedInputElement\` is set) and the keydown target IS that
        // input (or a descendant of it, including across Shadow DOM via
        // composedPath), we must let normal typing keys reach the input
        // without capture-phase stopPropagation on document blocking child
        // editor listeners.
        //
        // Escape is always handled: it cancels the picker regardless of
        // where the user is typing.
        const onKeyDown = (e) => {
            if (!e) return;

            // Escape always cancels — even when typing inside the selected
            // input, the picker should respond to Escape.
            if (e.key === 'Escape') {
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
                if (typeof e.preventDefault === 'function') e.preventDefault();
                safePickerLog('picker.cancelled', null);
                window._aiPickerCancelled = true;
                // Emit the cancellation marker so the bridge's
                // console-message listener fires \`onCancelled\`. Without
                // this, the renderer never knows the user pressed Escape
                // and the toggle button keeps showing "active".
                try {
                    (window.console && window.console.log
                        ? window.console.log.bind(window.console)
                        : function () {}
                    )(__aiPickerSessionId ? '_aiPicker:cancelled:' + __aiPickerSessionId : '_aiPicker:cancelled');
                } catch (e2) { safePickerLog('keydown.consoleEmit', e2); }
                cleanup();
                return;
            }

            if (selectedInputElement) {
                let isInsideSelected = false;
                try {
                    var keyCtx = getEventContext(e);
                    var rawKeyTarget = keyCtx.rawTarget || e.target;
                    isInsideSelected =
                        rawKeyTarget === selectedInputElement ||
                        (Array.isArray(keyCtx.path) && keyCtx.path.indexOf(selectedInputElement) >= 0) ||
                        (rawKeyTarget &&
                            typeof selectedInputElement.contains === 'function' &&
                            selectedInputElement.isConnected &&
                            selectedInputElement.contains(rawKeyTarget));
                } catch (containsErr) {
                    safePickerLog('keydown.contains', containsErr);
                }
                if (isInsideSelected) {
                    // Prevent Enter (without Shift) from prematurely submitting
                    // the AI composer during Step 2 before the send button is picked;
                    // instead, advance directly to Step 3 ('submit').
                    if (e.key === 'Enter' && !e.shiftKey) {
                        if (typeof e.preventDefault === 'function') e.preventDefault();
                        if (typeof e.stopPropagation === 'function') e.stopPropagation();
                        if (step === 'typing') {
                            if (typingAdvanceTimer) {
                                clearTimeout(typingAdvanceTimer);
                                pendingTimers.delete(typingAdvanceTimer);
                                typingAdvanceTimer = null;
                            }
                            step = 'submit';
                            updateInfoBox(null);
                        }
                        return;
                    }
                    // Block navigation / function / host-shortcut combos even
                    // while focused inside the selected input.
                    if (
                        e.key === 'Tab' ||
                        /^F\\d+$/i.test(e.key || '') ||
                        ((e.ctrlKey || e.metaKey || e.altKey) && e.key && e.key.length > 1)
                    ) {
                        if (typeof e.preventDefault === 'function') e.preventDefault();
                        if (typeof e.stopPropagation === 'function') e.stopPropagation();
                        return;
                    }
                    // For printable characters / edits in Step 2, also trigger
                    // typing detection so custom editors that swallow input events
                    // still advance smoothly to Step 3.
                    if (
                        step === 'typing' &&
                        typeof e.key === 'string' &&
                        (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') &&
                        !e.ctrlKey &&
                        !e.metaKey &&
                        !e.altKey
                    ) {
                        onTypingDetected(e);
                    }
                    return;
                }
            }

            // Outside the selected input: swallow all keys. C3's original
            // rationale still applies — Tab could open dev tools, Enter
            // could submit a form, Cmd+K could trigger host shortcuts.
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
        };

        const onTypingDetected = (e) => {
            if (step !== 'typing' || !selectedInputElement) return;

            var typeCtx = getEventContext(e);
            const target = normalizeTarget(typeCtx.rawTarget, typeCtx.path);
            if (!target) return;

            // The site can replace the composer node after it was picked
            // (focus-time hydration, SPA re-render). The old node is detached,
            // so every containment check below fails and typing would be
            // invisible to the picker: step 2 never advances. Re-bind to the
            // text control that is actually receiving keys BEFORE the
            // containment checks run.
            if (
                selectedInputElement.isConnected === false &&
                target.isConnected !== false &&
                isTextEntryControl(target)
            ) {
                safePickerLog('typing.rebind', target);
                commitInputSelection(target);
            }

            const isDirectInput = target === selectedInputElement;
            const isInComposedPath = Array.isArray(typeCtx.path) && typeCtx.path.indexOf(selectedInputElement) >= 0;
            const isNestedInput = !!(selectedInputElement.isConnected && selectedInputElement.contains && selectedInputElement.contains(target));
            // Some editors dispatch input/change on their wrapper instead of the
            // editable node. Accept that direction too, but never let a carrier
            // as broad as <body>/<html> count as "typing in the editor".
            var isWrapperCarrier = false;
            try {
                var carrierDoc = target.ownerDocument;
                isWrapperCarrier = !!(
                    target !== selectedInputElement &&
                    target.isConnected &&
                    typeof target.contains === 'function' &&
                    target.contains(selectedInputElement) &&
                    carrierDoc &&
                    target !== carrierDoc.body &&
                    target !== carrierDoc.documentElement
                );
            } catch (carrierErr) { isWrapperCarrier = false; }

            if (!isDirectInput && !isInComposedPath && !isNestedInput && !isWrapperCarrier) {
                return;
            }

            if (typingAdvanceTimer) {
                clearTimeout(typingAdvanceTimer);
                pendingTimers.delete(typingAdvanceTimer);
            }

            typingAdvanceTimer = scheduleTimer(() => {
                typingAdvanceTimer = null;
                if (step !== 'typing') return;
                step = 'submit';
                updateInfoBox(null);
            }, 120);
        };
 `
}
