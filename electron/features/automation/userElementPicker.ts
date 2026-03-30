/**
 * Kullanıcı Tanımlı Element Seçici (Picker) Modülü
 *
 * Bu modül, webview içine enjekte edilecek ve kullanıcının
 * etkileşime girmek istediği elementleri (Input ve Button)
 * manuel olarak seçmesini sağlayacak mantığı içerir.
 */

import { pickerStyles } from './utils/styles'
import { getElementInfo, generateLocatorBundle, inferSendLikeControl } from './utils/domHelpers'
import { getStepHtml, getHintHtml, type TranslationMap } from './utils/uiTemplates'

/**
 * Webview içine enjekte edilecek "Picker" scripti.
 * Bu script, sayfadaki elementleri vurgular ve tıklamaları yakalar.
 *
 * Electron executeJavaScript yalnızca ana çerçevede çalışır; ana sayfa içeriği
 * aynı kökenli bir iframe içindeyse olaylar üst document'a gitmez. Bu yüzden
 * dinleyiciler hem ana belgeye hem de erişilebilen iframe belgelerine eklenir.
 *
 * @returns {string} Enjekte edilecek JS kodu
 */
export const generatePickerScript = (translations: TranslationMap = {}): string => {
  return `
    (function() {
        // Capture original console to avoid overridden methods
        const safeConsole = {
            info: (window.console && window.console.info) ? window.console.info.bind(window.console) : function(){},
            error: (window.console && window.console.error) ? window.console.error.bind(window.console) : function(){}
        };

        const TRANSLATIONS = ${JSON.stringify(translations)};
        
        // Temizlik: Önceki picker kalıntılarını temizle
        if (window._aiPickerCleanup) window._aiPickerCleanup();

        // Picker initialized

        // Durum Yönetimi - 3 ADIM (tüm çerçeveler için tek paylaşılan durum)
        let step = 'input'; // 'input' | 'typing' | 'submit' | 'done'
        const selectionData = {
            version: 2,
            input: null,
            button: null,
            waitFor: null,
            submitMode: 'mixed',
            inputCandidates: [],
            buttonCandidates: [],
            inputFingerprint: null,
            buttonFingerprint: null
        };
        let selectedInputElement = null;
        let typingAdvanceTimer = null;

        // --- HELPER FUNCTIONS INJECTION ---
        const inferSendLikeControl = ${inferSendLikeControl.toString()};
        const getElementInfo = ${getElementInfo.toString()};
        const generateLocatorBundle = ${generateLocatorBundle.toString()};
        const getStepHtml = ${getStepHtml.toString()};
        const getHintHtml = ${getHintHtml.toString()};

        // --- TRUSTED TYPES BYPASS ---
        let ttPolicy = { createHTML: s => s, createScript: s => s };
        if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
            try {
                ttPolicy = trustedTypes.createPolicy('ai-picker-ext-' + Date.now(), { 
                    createHTML: s => s, 
                    createScript: s => s 
                });
            } catch (e) {
                // Ignore if creating policy fails (due to strict CSP)
            }
        }

        const mainDoc = document;
        let styleEl = null;

        // --- UI BİLEŞENLERİ (ana çerçeve — fixed overlay iframe üstünde görünür) ---

        // 1. Ana Bilgi Paneli (SOL ÜST - daha az engelleyici)
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
                    infoBox.innerHTML = stepHtml + hintHtml;
                }
                infoBox.style.borderTop = '3px solid ' + statusColor;
                
                // "Devam Et" butonuna event listener ekle
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

        // 2. Element Etiketi (Mouse Yanında - daha küçük)
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

        // --- STYLES ---
        try {
            styleEl = mainDoc.createElement('style');
            try {
                styleEl.textContent = ttPolicy.createHTML(\`${pickerStyles}\`);
            } catch(e) {
                styleEl.textContent = \`${pickerStyles}\`;
            }
            if (mainDoc.head) mainDoc.head.appendChild(styleEl);
        } catch(e) {
            safeConsole.error('Style injection failed', e);
        }

        // --- EVENT HANDLERS ---
        let lastHovered = null;

        // composedPath yalnızca bir kez; gönder tespiti path üzerinden (parentElement zinciri yerine)
        const getEventContext = (event) => {
            var path = null;
            var rawTarget = null;
            if (event && typeof event.composedPath === 'function') {
                path = event.composedPath();
                for (var i = 0; i < path.length; i++) {
                    var c = path[i];
                    if (c && c.nodeType === 1) {
                        rawTarget = c;
                        break;
                    }
                }
            } else if (event && event.target) {
                var t = event.target;
                rawTarget = t.nodeType === 1 ? t : (t.parentElement || null);
                path = [];
            }
            return { rawTarget: rawTarget, path: path || [] };
        };

        const ancestorChain = (el) => {
            var a = [];
            var n = el;
            for (var d = 0; n && n.nodeType === 1 && d < 16; d++) {
                a.push(n);
                n = n.parentElement;
            }
            return a;
        };

        const normalizeTarget = (rawTarget, optPath) => {
            if (!rawTarget) return null;
            if (rawTarget.nodeType !== 1) return null;
            var target = rawTarget;

            if (step === 'submit' || step === 'typing') {
                var nodes = optPath && optPath.length ? optPath : ancestorChain(rawTarget);
                var max = Math.min(nodes.length, 16);
                for (var j = 0; j < max; j++) {
                    var node = nodes[j];
                    if (node && node.nodeType === 1 && inferSendLikeControl(node)) {
                        return node;
                    }
                }
                var sendBtn = rawTarget.closest('button, [role="button"], a');
                if (sendBtn) return sendBtn;
                return rawTarget;
            }

            var buttonAncestor = target.closest('button, [role="button"], a');
            if (buttonAncestor && target !== buttonAncestor) {
                target = buttonAncestor;
            }

            var textbox = target.closest('[role="textbox"], [contenteditable="true"], input, textarea');
            if (textbox && target !== textbox) {
                if (!target.closest('button, [role="button"], a')) {
                    target = textbox;
                }
            }

            return target;
        };

        const onMouseOver = (e) => {
            // Sadece adım 1 ve 3'te hover aktif
            if (step !== 'input' && step !== 'submit') return;
            if (step === 'done') return;
            e.stopPropagation();
            try {
                var ctx = getEventContext(e);
                const target = normalizeTarget(ctx.rawTarget, ctx.path);
                if (!target) return;

                if (lastHovered === target) return;

                // Temizle
                if (lastHovered && lastHovered !== selectedInputElement) {
                    lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                }
                
                lastHovered = target;
                
                // Element bilgisini al
                const info = getElementInfo(target);
                
                // Adıma göre uygunluğu belirle
                const isGoodChoice = (step === 'input' && info.category === 'input') || 
                                    (step === 'submit' && info.category === 'button');
                const isMediumChoice = (step === 'input' && target.isContentEditable) ||
                                    (step === 'submit' && (info.category === 'container' || info.tag === 'a'));
                
                // Hover sınıfını ekle
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

                // Etiketi güncelle
                const labelText = (info.labelKey && TRANSLATIONS[info.labelKey]) ? TRANSLATIONS[info.labelKey] : info.labelEN;
                labelBox.textContent = labelText;
                labelBox.style.background = labelBg;
                labelBox.style.display = 'block';
                positionLabelBox(e.clientX, e.clientY);
                
                // Ana paneli güncelle
                updateInfoBox(info);
            } catch (err) {
                // Ignore hover errors
            }
        };

        const onMouseMove = (e) => {
            if (labelBox.style.display !== 'block') return;
            
            // Throttle UI updates using requestAnimationFrame
            if (window._aiPickerRaf) cancelAnimationFrame(window._aiPickerRaf);
            
            window._aiPickerRaf = requestAnimationFrame(() => {
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
            // Clear any pending RAF
            if (window._aiPickerRaf) cancelAnimationFrame(window._aiPickerRaf);
            labelBox.style.display = 'none';
        };

        const onClick = (e) => {
            // Adım 2'de tıklama algılama
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

            // Element selected

            // Görsel onay
            try {
                const flashColor = step === 'input' ? '#60a5fa' : '#4ade80';
                target.style.transition = 'all 0.3s ease';
                target.style.boxShadow = '0 0 30px ' + flashColor;

                setTimeout(() => {
                    if (target) target.style.boxShadow = '';
                }, 300);
            } catch (err) {}

            // ADIM 1: Input seçildi
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
            // ADIM 3: Submit seçildi
            else if (step === 'submit') {
                try {
                    selectionData.button = locatorBundle.primarySelector;
                    selectionData.buttonCandidates = locatorBundle.candidates || [];
                    selectionData.buttonFingerprint = locatorBundle.fingerprint;
                    step = 'done';
                    
                    target.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                    labelBox.style.display = 'none';
                    updateInfoBox(null);
                    
                    // Temizlik ve sonuç
                    setTimeout(() => {
                        try {
                            if (selectedInputElement) {
                                selectedInputElement.classList.remove('_ai-picker-selected');
                            }
                        } catch (e) {}


                        // Store result in global variable for polling
                        window._aiPickerResult = JSON.parse(JSON.stringify(selectionData));
                        
                        // Delay cleanup to allow polling to pick up the result
                        setTimeout(() => { cleanup(); }, 300);
                    }, 500);
                } catch (err) {
                    safeConsole.error('Submit step error', err);
                    cleanup(); // Fail safe
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

        const listenerRoots = [];
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
                    } catch (err) {}
                });
            } catch (err) {}
        };
        const scheduleIframeScan = () => {
            if (scanIframesScheduled) return;
            scanIframesScheduled = true;
            iframeScanRafId = requestAnimationFrame(function() {
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
        } catch (err) {}

        const cleanup = () => {
            try {
                try { iframeObserver.disconnect(); } catch (e) {}
                if (iframeScanRafId != null) {
                    try { cancelAnimationFrame(iframeScanRafId); } catch (e) {}
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
                            try { delete rootDoc.documentElement.__aiPickerListenersAttached; } catch (e) {}
                        }
                    } catch (e) {}
                }
                listenerRoots.length = 0;
                if (typingAdvanceTimer) {
                    clearTimeout(typingAdvanceTimer);
                    typingAdvanceTimer = null;
                }
                if (window._aiPickerRaf) {
                    cancelAnimationFrame(window._aiPickerRaf);
                    delete window._aiPickerRaf;
                }
                if (lastHovered) {
                    try {
                        lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                    } catch(e){}
                }
                if (selectedInputElement) {
                    try {
                        selectedInputElement.classList.remove('_ai-picker-selected');
                    } catch(e){}
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
    })();
    `
}
