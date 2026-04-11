/** Pointer / click / keyboard / typing-advance handlers. */
export function buildPickerHandlersBlock(): string {
  return `        const onMouseOver = (e) => {
            if (step !== 'input' && step !== 'submit') return;
            if (step === 'done') return;
            e.stopPropagation();
            try {
                var ctx = getEventContext(e);
                const target = normalizeTarget(ctx.rawTarget, ctx.path);
                if (!target) return;

                if (lastHovered === target) return;

                if (lastHovered && lastHovered !== selectedInputElement) {
                    lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                }
                
                lastHovered = target;
                
                const info = getElementInfo(target);
                
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

                const targetInfo = getElementInfo(target);
                if (targetInfo.category === 'button') {
                    step = 'submit';
                    updateInfoBox(null);
                } else {
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

            try {
                const flashColor = step === 'input' ? '#60a5fa' : '#4ade80';
                target.style.transition = 'all 0.3s ease';
                target.style.boxShadow = '0 0 30px ' + flashColor;

                setTimeout(() => {
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
                    
                    setTimeout(() => {
                        try {
                            if (selectedInputElement) {
                                selectedInputElement.classList.remove('_ai-picker-selected');
                            }
                        } catch (e) { safePickerLog('submit.selectedInputClass', e); }


                        window._aiPickerResult = JSON.parse(JSON.stringify(selectionData));
                        
                        setTimeout(() => { cleanup(); }, 300);
                    }, 500);
                } catch (err) {
                    safeConsole.error('Submit step error', err);
                    cleanup();
                }
            }
        };

        const onKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();

            window._aiPickerCancelled = true;
            cleanup();
        };

        const onTypingDetected = (e) => {
            if (step !== 'typing' || !selectedInputElement) return;

            var typeCtx = getEventContext(e);
            const target = normalizeTarget(typeCtx.rawTarget, typeCtx.path);
            if (!target) return;

            const selectedRoot = selectedInputElement.getRootNode ? selectedInputElement.getRootNode() : null;
            const targetRoot = target.getRootNode ? target.getRootNode() : null;
            const isDirectInput = target === selectedInputElement;
            const isNestedInput = !!selectedInputElement.contains && selectedInputElement.contains(target);
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
