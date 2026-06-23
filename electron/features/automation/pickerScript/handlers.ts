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

        const onMouseOver = (e) => {
            if (step !== 'input' && step !== 'submit') return;
            if (step === 'done') return;
            e.stopPropagation();
            try {
                var ctx = getEventContext(e);
                const target = normalizeTarget(ctx.rawTarget, ctx.path);
                if (!target) return;

                if (lastHovered === target) return;

                // I5: detect detached \`lastHovered\` (page mutation can rip
                // the previously hovered node out of the DOM between mouse
                // events). Logging helps diagnose "hover stuck on ghost" bugs.
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
                
                const isGoodChoice = (step === 'input' && info.category === 'input') || 
                                    (step === 'submit' && info.category === 'button');
                const isMediumChoice = (step === 'input' && target.isContentEditable) ||
                                    (step === 'submit' && (info.category === 'container' || info.tag === 'a'));
                
                let cls;
                let labelBg;
                if (isGoodChoice || info.confidence === 'high') {
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
                labelBox.style.display = 'block';
                positionLabelBox(e.clientX, e.clientY);
                
                updateInfoBox(info);
            } catch (err) {
                safePickerLog('hover.update', err);
            }
        };

        const onMouseMove = (e) => {
            if (labelBox.style.display !== 'block') return;
            
            if (window._aiPickerRaf) safeCancelAnimationFrame(window._aiPickerRaf);
            
            window._aiPickerRaf = safeRequestAnimationFrame(() => {
                positionLabelBox(e.clientX, e.clientY);
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
        
        const onMouseOut = () => {
            if (step === 'typing') return;
            if (window._aiPickerRaf) safeCancelAnimationFrame(window._aiPickerRaf);
            labelBox.style.display = 'none';
        };

        const onClick = (e) => {
            if (step === 'done') return;
            
            e.preventDefault();
            e.stopPropagation();

            var clickCtx = getEventContext(e);
            const target = normalizeTarget(clickCtx.rawTarget, clickCtx.path);
            if (!target) return;

            if (step === 'typing') {
                if (target.id === '_ai_picker_next_btn') {
                    step = 'submit';
                    updateInfoBox(null);
                    return;
                }

                const targetInfo = memoGetElementInfo(target);
                if (targetInfo.category === 'button') {
                    step = 'submit';
                    updateInfoBox(null);
                } else {
                    // S7: wrong target visual feedback — flash the rejected
                    // node red so the user understands why nothing happened.
                    try {
                        target.style.transition = 'all 0.2s ease';
                        target.style.boxShadow = '0 0 25px #ef4444';
                        scheduleTimer(() => {
                            if (target) target.style.boxShadow = '';
                        }, 200);
                    } catch (err) { safePickerLog('click.wrongFlash', err); }
                    return;
                }
            }

            let locatorBundle = null;
            try {
                locatorBundle = generateLocatorBundle(target, step === 'input' ? 'input' : 'button');
            } catch (err) {
                safeConsole.error('Selector generation failed', err);
                return;
            }

            if (!locatorBundle || !locatorBundle.fingerprint) {
                safeConsole.error('Locator bundle generation returned empty result');
                return;
            }

            // S4: track every flash timer so cleanup drains it. Without this
            // the \`setTimeout(..., 300)\` could fire AFTER cleanup removed
            // the selected class, leaving a stale box-shadow on the host.
            try {
                const flashColor = step === 'input' ? '#60a5fa' : '#4ade80';
                target.style.transition = 'all 0.3s ease';
                target.style.boxShadow = '0 0 30px ' + flashColor;

                scheduleTimer(() => {
                    if (target) target.style.boxShadow = '';
                }, 300);
            } catch (err) {
                safePickerLog('click.flash', err);
            }

            if (step === 'input') {
                selectionData.input = locatorBundle.primarySelector;
                selectionData.waitFor = locatorBundle.primarySelector;
                selectionData.inputCandidates = locatorBundle.candidates || [];
                selectionData.inputFingerprint = locatorBundle.fingerprint;
                selectedInputElement = target;
                target.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                target.classList.add('_ai-picker-selected');
                step = 'typing';
                labelBox.style.display = 'none';
                updateInfoBox(null);
            } 
            else if (step === 'submit') {
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

                        // Bridge wiring: the renderer-side \`usePickerConsoleBridge\`
                        // listens for \`console-message\` events from the
                        // webview and routes messages that start with
                        // \`_aiPicker:\` to the picker callbacks. Without
                        // this emit, the bridge would never fire
                        // \`onResult\` and the picker would never auto-close
                        // (the user reported the picker "stays open" after
                        // a successful selection — root cause was this
                        // missing emit, not the timer race).
                        try {
                            (window.console && window.console.log
                                ? window.console.log.bind(window.console)
                                : function () {}
                            )('_aiPicker:result:' + resultJson);
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
        // input (or a descendant of it), we must let the key reach the
        // input. Otherwise the input's value never updates, the \`input\`
        // event never fires, \`onTypingDetected\` never advances the picker
        // to \`step='submit'\`, and the send button never becomes pickable.
        // This is the root cause of the "I can pick the input but can't
        // type so the send button never appears" bug.
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
                    )('_aiPicker:cancelled');
                } catch (e2) { safePickerLog('keydown.consoleEmit', e2); }
                cleanup();
                return;
            }

            // Typing inside the selected input: let the key through so the
            // input's value updates and the \`input\` event fires
            // \`onTypingDetected\`. We do still stopPropagation so the host
            // site's own keydown handlers (e.g. Cmd+K listener) don't
            // double-fire alongside the input's own handler.
            if (selectedInputElement && e.target) {
                let isInsideSelected = false;
                try {
                    isInsideSelected =
                        e.target === selectedInputElement ||
                        (typeof selectedInputElement.contains === 'function' &&
                            selectedInputElement.isConnected &&
                            selectedInputElement.contains(e.target));
                } catch (containsErr) {
                    safePickerLog('keydown.contains', containsErr);
                }
                if (isInsideSelected) {
                    if (typeof e.stopPropagation === 'function') e.stopPropagation();
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

            // I7: selectedInputElement can become detached. \`contains\`
            // throws on detached subtrees in some browsers, so guard.
            let selectedRoot = null;
            let targetRoot = null;
            try {
                selectedRoot = selectedInputElement.getRootNode ? selectedInputElement.getRootNode() : null;
                targetRoot = target.getRootNode ? target.getRootNode() : null;
            } catch (err) { safePickerLog('typing.rootNode', err); }

            const isDirectInput = target === selectedInputElement;
            const isNestedInput = !!(selectedInputElement.isConnected && selectedInputElement.contains && selectedInputElement.contains(target));
            const isSameRoot = !!selectedRoot && !!targetRoot && selectedRoot === targetRoot;

            if (!isDirectInput && !isNestedInput && !isSameRoot) {
                return;
            }

            if (typingAdvanceTimer) {
                clearTimeout(typingAdvanceTimer);
            }

            typingAdvanceTimer = setTimeout(() => {
                if (step !== 'typing') return;
                step = 'submit';
                updateInfoBox(null);
            }, 120);
        };
 `
}
