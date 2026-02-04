export type PickerCategory = 'input' | 'button' | 'container' | 'icon' | 'text' | 'unknown';
export type PickerConfidence = 'high' | 'medium' | 'low';
export interface PickerElementInfo {
    category: PickerCategory;
    labelEN: string;
    labelKey?: string;
    confidence: PickerConfidence;
    tag: string;
    hintKey?: string;
    hintEN?: string;
}
type PickerElement = Element & {
    isContentEditable?: boolean;
    onclick?: ((this: GlobalEventHandlers, ev: MouseEvent) => unknown) | null;
};
export declare const getElementInfo: (el: PickerElement) => PickerElementInfo;
export declare const generateRobustSelector: (el: Element | null) => string | null;
export {};
