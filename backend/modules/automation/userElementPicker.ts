/**
 * Kullanıcı Tanımlı Element Seçici (Picker) Modülü
 * 
 * Bu modül, webview içine enjekte edilecek ve kullanıcının
 * etkileşime girmek istediği elementleri (Input ve Button)
 * manuel olarak seçmesini sağlayacak mantığı içerir.
 */

import { pickerStyles } from './picker/styles';
import { getElementInfo, generateRobustSelector } from './picker/domHelpers';
import { getStepHtml, getHintHtml, type TranslationMap } from './picker/uiTemplates';

/**
 * Webview içine enjekte edilecek "Picker" scripti.
 * Bu script, sayfadaki elementleri vurgular ve tıklamaları yakalar.
 * 
 * @returns {string} Enjekte edilecek JS kodu
 */
export const generatePickerScript = (translations: TranslationMap = {}): string => {
    return `
    (function() {
        const DEBUG_PREFIX = '[AI-Picker]';
        const TRANSLATIONS = ${JSON.stringify(translations)};
        
        // Temizlik: Önceki picker kalıntılarını temizle
        if (window._aiPickerCleanup) window._aiPickerCleanup();

        // Picker initialized

        // Durum Yönetimi - 3 ADIM
        let step = 'input'; // 'input' | 'typing' | 'submit' | 'done'
        const selectionData = { input: null, button: null };
        let selectedInputElement = null;

        // --- HELPER FUNCTIONS INJECTION ---
        const getElementInfo = ${getElementInfo.toString()};
        const generateRobustSelector = ${generateRobustSelector.toString()};
        const getStepHtml = ${getStepHtml.toString()};
        const getHintHtml = ${getHintHtml.toString()};

        // --- UI BİLEŞENLERİ ---

        // 1. Ana Bilgi Paneli (SOL ÜST - daha az engelleyici)
        const infoBox = document.createElement('div');
        Object.assign(infoBox.style, {
            position: 'fixed', top: '20px', left: '20px', 
            width: '320px', padding: '16px',
            background: 'linear-gradient(145deg, rgba(15, 15, 25, 0.95), rgba(5, 5, 15, 0.95))', 
            color: 'white', borderRadius: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px',
            zIndex: '999999', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)',
            pointerEvents: 'none', userSelect: 'none', transition: 'all 0.3s ease'
        });

        const updateInfoBox = (hoveredInfo) => {
            const { html: stepHtml, color: statusColor } = getStepHtml(step, TRANSLATIONS);
            const hintHtml = getHintHtml(step, hoveredInfo, TRANSLATIONS);
            
            infoBox.innerHTML = stepHtml + hintHtml;
            infoBox.style.borderTop = '3px solid ' + statusColor;
            
            // "Devam Et" butonuna event listener ekle
            if (step === 'typing') {
                const nextBtn = document.getElementById('_ai_picker_next_btn');
                if (nextBtn) {
                    nextBtn.onclick = function(e) {
                        e.stopPropagation();
                        step = 'submit';
                        updateInfoBox(null);
                    };
                }
            }
        };
        document.body.appendChild(infoBox);
        updateInfoBox(null);

        // 2. Element Etiketi (Mouse Yanında - daha küçük)
        const labelBox = document.createElement('div');
        Object.assign(labelBox.style, {
            position: 'fixed', padding: '6px 10px', 
            background: 'rgba(0,0,0,0.85)', 
            color: 'white', borderRadius: '6px', fontSize: '11px', fontWeight: '500', 
            pointerEvents: 'none', zIndex: '1000000', display: 'none', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: '200px', whiteSpace: 'nowrap'
        });
        document.body.appendChild(labelBox);

        // --- STYLES ---
        const style = document.createElement('style');
        style.textContent = \`${pickerStyles}\`;
        document.head.appendChild(style);

        // --- EVENT HANDLERS ---
        let lastHovered = null;

        const onMouseOver = (e) => {
            // Sadece adım 1 ve 3'te hover aktif
            if (step !== 'input' && step !== 'submit') return;
            if (step === 'done') return;
            e.stopPropagation();

            let target = e.target;
            
            // SVG/PATH Düzeltmesi
            if (['svg', 'path', 'rect', 'polygon'].includes(target.tagName.toLowerCase())) {
                const btn = target.closest('button, [role="button"], a');
                if (btn) target = btn;
            }

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
            labelBox.innerHTML = labelText;
            labelBox.style.background = labelBg;
            labelBox.style.display = 'block';
            labelBox.style.top = (e.clientY + 20) + 'px';
            labelBox.style.left = (e.clientX + 15) + 'px';
            
            // Ana paneli güncelle
            updateInfoBox(info);
        };

        const onMouseMove = (e) => {
            if (labelBox.style.display !== 'block') return;
            
            // Throttle UI updates using requestAnimationFrame
            if (window._aiPickerRaf) cancelAnimationFrame(window._aiPickerRaf);
            
            window._aiPickerRaf = requestAnimationFrame(() => {
                labelBox.style.top = (e.clientY + 20) + 'px';
                labelBox.style.left = (e.clientX + 15) + 'px';
            });
        };
        
        const onMouseOut = (e) => {
            if (step === 'typing') return;
            // Clear any pending RAF
            if (window._aiPickerRaf) cancelAnimationFrame(window._aiPickerRaf);
            labelBox.style.display = 'none';
        };

        const onClick = (e) => {
            // Adım 2'de tıklama algılama
            if (step === 'typing') return;
            if (step === 'done') return;
            
            e.preventDefault();
            e.stopPropagation();

            let target = e.target;

            // SVG/PATH Düzeltmesi
            if (['svg', 'path', 'rect', 'polygon'].includes(target.tagName.toLowerCase())) {
                const btn = target.closest('button, [role="button"], a');
                if (btn) target = btn;
            }

            const selector = generateRobustSelector(target);
            const info = getElementInfo(target);
            // Element selected

            // Görsel onay
            const flashColor = step === 'input' ? '#60a5fa' : '#4ade80';
            target.style.transition = 'all 0.3s ease';
            target.style.boxShadow = '0 0 30px ' + flashColor;

            setTimeout(() => {
                target.style.boxShadow = '';
            }, 300);

            // ADIM 1: Input seçildi
            if (step === 'input') {
                selectionData.input = selector;
                selectedInputElement = target;
                target.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                target.classList.add('_ai-picker-selected');
                step = 'typing';
                labelBox.style.display = 'none';
                updateInfoBox(null);
            } 
            // ADIM 3: Submit seçildi
            else if (step === 'submit') {
                selectionData.button = selector;
                step = 'done';
                target.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
                labelBox.style.display = 'none';
                updateInfoBox(null);
                
                // Temizlik ve sonuç
                setTimeout(() => {
                    if (selectedInputElement) {
                        selectedInputElement.classList.remove('_ai-picker-selected');
                    }
                    cleanup();
                    console.info('__AI_PICKER_RESULT__' + JSON.stringify(selectionData));
                }, 800);
            }
        };

        document.addEventListener('mouseover', onMouseOver, true);
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseout', onMouseOut, true);
        document.addEventListener('click', onClick, true);

        const cleanup = () => {
            document.removeEventListener('mouseover', onMouseOver, true);
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('mouseout', onMouseOut, true);
            document.removeEventListener('click', onClick, true);
            if (lastHovered) {
                lastHovered.classList.remove('_ai-picker-hover-good', '_ai-picker-hover-medium', '_ai-picker-hover-low');
            }
            if (selectedInputElement) {
                selectedInputElement.classList.remove('_ai-picker-selected');
            }
            infoBox.remove();
            labelBox.remove();
            style.remove();
            delete window._aiPickerCleanup;
        };

        window._aiPickerCleanup = cleanup;
    })();
    `;
};
