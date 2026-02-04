import type { PickerElementInfo } from './domHelpers';
export type PickerStep = 'input' | 'typing' | 'submit' | 'done';
export type TranslationMap = Record<string, string>;
export declare const getStepHtml: (step: PickerStep, t?: TranslationMap) => {
    html: string;
    color: string;
};
export declare const getHintHtml: (step: PickerStep, hoveredInfo: PickerElementInfo | null, t?: TranslationMap) => string;
