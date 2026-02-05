import type { PickerElementInfo, PickerConfidence } from './domHelpers'

export type PickerStep = 'input' | 'typing' | 'submit' | 'done'
export type TranslationMap = Record<string, string>

export const getStepHtml = (step: PickerStep, t: TranslationMap = {}) => {
    let statusColor = '#60a5fa';
    let stepHtml = '';

    const labelStep = t.picker_step || 'Step';
    const labelDone = t.picker_done_btn || 'Done, Continue';

    // ADIM 1: Mesaj yazma alanını seç
    if (step === 'input') {
        const title = t.picker_intro_title || 'Select Message Input';
        const text = t.picker_intro_text || 'Find the box where you type messages and <b>click on it</b>.';

        statusColor = '#60a5fa';
        stepHtml = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#60a5fa,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;">1</div>
            <div>
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${labelStep} 1 / 3</div>
            <div style="font-size:14px;font-weight:600;color:#60a5fa;">${title}</div>
            </div>
            </div>
            <div style="background:rgba(96,165,250,0.12);border-radius:6px;padding:10px;border-left:3px solid #60a5fa;font-size:12px;">
            <div style="color:#e2e8f0;line-height:1.4;">
            ${text}
            </div>
            </div>`;
    }
    // ADIM 2: Test karakteri yaz
    else if (step === 'typing') {
        const title = t.picker_typing_title || 'Type a Letter';
        const text = t.picker_typing_text || 'Type <b>any letter</b> in the selected area. The send button will appear.';

        statusColor = '#f59e0b';
        stepHtml = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;">2</div>
            <div>
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${labelStep} 2 / 3</div>
            <div style="font-size:14px;font-weight:600;color:#f59e0b;">${title}</div>
            </div>
            </div>
            <div style="background:rgba(245,158,11,0.12);border-radius:6px;padding:10px;border-left:3px solid #f59e0b;font-size:12px;">
            <div style="color:#e2e8f0;line-height:1.4;">
            ${text}
            </div>
            </div>
            <div style="margin-top:10px;text-align:center;">
            <div style="display:inline-block;background:#f59e0b;color:#000;padding:6px 16px;border-radius:6px;font-weight:600;font-size:12px;pointer-events:auto;cursor:pointer;" id="_ai_picker_next_btn">${labelDone}</div>
            </div>`;
    }
    // ADIM 3: Gönder butonunu seç
    else if (step === 'submit') {
        const title = t.picker_submit_title || 'Click Send Button';
        const text = t.picker_submit_text || '<b>Click the send button</b> you use to send messages.';

        statusColor = '#4ade80';
        stepHtml = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4ade80,#22c55e);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;">3</div>
            <div>
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${labelStep} 3 / 3</div>
            <div style="font-size:14px;font-weight:600;color:#4ade80;">${title}</div>
            </div>
            </div>
            <div style="background:rgba(74,222,128,0.12);border-radius:6px;padding:10px;border-left:3px solid #4ade80;font-size:12px;">
            <div style="color:#e2e8f0;line-height:1.4;">
            ${text}
            </div>
            </div>`;
    }
    // TAMAMLANDI
    else {
        const completed = t.picker_completed || 'Completed!';
        const saving = t.picker_saving || 'Saving settings...';

        statusColor = '#a78bfa';
        stepHtml = `<div style="display:flex;align-items:center;gap:10px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#a78bfa,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:20px;">&#10003;</div>
            <div>
            <div style="font-size:14px;font-weight:600;color:#a78bfa;">${completed}</div>
            <div style="font-size:11px;color:#94a3b8;">${saving}</div>
            </div>
            </div>`;
    }

    return { html: stepHtml, color: statusColor };
};

export const getHintHtml = (step: PickerStep, hoveredInfo: PickerElementInfo | null, t: TranslationMap = {}) => {
    if (!hoveredInfo || (step !== 'input' && step !== 'submit')) return '';

    const confidenceColors: Record<PickerConfidence, string> = { high: '#4ade80', medium: '#fbbf24', low: '#f87171' };

    // Map confidence levels to localized strings
    const confidenceLabels: Record<PickerConfidence, string> = {
        high: t.picker_good_choice || 'Good Choice',
        medium: t.picker_maybe || 'Maybe',
        low: t.picker_wrong || 'Wrong'
    };

    // Determine if it's a good choice based on step and category
    const isGoodChoice = (step === 'input' && hoveredInfo.category === 'input') ||
        (step === 'submit' && hoveredInfo.category === 'button');

    const bgColor = isGoodChoice ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)';
    const textColor = isGoodChoice ? '#4ade80' : '#fbbf24';

    // Get localized label
    // Check if we have a translation key and translation available
    const labelText = (hoveredInfo.labelKey && t[hoveredInfo.labelKey]) ? t[hoveredInfo.labelKey] : hoveredInfo.labelEN;

    let hintText = '';
    if (hoveredInfo.hintKey && t[hoveredInfo.hintKey]) {
        hintText = t[hoveredInfo.hintKey];
    } else {
        // Fallback to existing logic if key is missing (during transition)
        hintText = hoveredInfo.hintEN || '';
    }

    let hintHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-weight:600;font-size:13px;">${labelText}</span>
        <div style="display:flex;align-items:center;gap:4px;">
        <span style="width:6px;height:6px;border-radius:50%;background:${confidenceColors[hoveredInfo.confidence]};"></span>
        <span style="font-size:10px;color:${confidenceColors[hoveredInfo.confidence]};">${confidenceLabels[hoveredInfo.confidence]}</span>
        </div>
        </div>`;

    if (hintText) {
        hintHtml += `<div style="font-size:11px;padding:6px;border-radius:4px;background:${bgColor};color:${textColor};line-height:1.3;">
            ${hintText}
            </div>`;
    }

    hintHtml += '</div>';
    return hintHtml;
};
