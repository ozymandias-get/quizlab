"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRobustSelector = exports.getElementInfo = void 0;
const getElementInfo = (el) => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const type = el.getAttribute('type');
    const contentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';
    let category = 'unknown';
    let labelEN = 'Unknown';
    let confidence = 'low';
    let hintEN = '';
    let labelKey;
    let hintKey;
    // INPUT types
    if (tag === 'input') {
        if (type === 'text' || type === 'search' || !type) {
            category = 'input';
            labelEN = 'Text Input';
            labelKey = 'picker_el_input';
            confidence = 'high';
            hintKey = 'picker_hint_input_correct';
        }
        else if (type === 'submit' || type === 'button') {
            category = 'button';
            labelEN = 'Submit Button';
            labelKey = 'picker_el_submit';
            confidence = 'high';
            hintKey = 'picker_hint_submit_correct';
        }
        else {
            category = 'input';
            labelEN = 'Input Field';
            labelKey = 'picker_el_input_field';
            confidence = 'medium';
        }
    }
    // TEXTAREA
    else if (tag === 'textarea') {
        category = 'input';
        labelEN = 'Message Box';
        labelKey = 'picker_el_msg_box';
        confidence = 'high';
        hintKey = 'picker_hint_textarea_perfect';
    }
    // BUTTON
    else if (tag === 'button' || role === 'button') {
        category = 'button';
        labelEN = 'Button';
        labelKey = 'picker_el_button';
        confidence = 'high';
        hintKey = 'picker_hint_button_send';
    }
    // ContentEditable DIV (ChatGPT style)
    else if (tag === 'div' && contentEditable) {
        category = 'input';
        labelEN = 'Message Input Area';
        labelKey = 'picker_el_msg_area';
        confidence = 'high';
        hintKey = 'picker_hint_input_correct';
    }
    // Normal DIV
    else if (tag === 'div') {
        const element = el;
        const hasClickHandler = typeof element.onclick === 'function';
        const isClickable = hasClickHandler || element.getAttribute('onclick') !== null || window.getComputedStyle(element).cursor === 'pointer';
        if (isClickable) {
            category = 'button';
            labelEN = 'Clickable Area';
            labelKey = 'picker_el_clickable';
            confidence = 'medium';
            hintKey = 'picker_hint_clickable';
        }
        else {
            category = 'container';
            labelEN = 'Container';
            labelKey = 'picker_el_container';
            confidence = 'low';
            hintKey = 'picker_hint_generic_box';
        }
    }
    // SVG/Icon
    else if (['svg', 'path', 'img', 'i'].includes(tag)) {
        category = 'icon';
        labelEN = 'Icon / Image';
        labelKey = 'picker_el_icon';
        confidence = 'low';
        hintKey = 'picker_hint_icon';
    }
    // A (Link)
    else if (tag === 'a') {
        category = 'button';
        labelEN = 'Link / Button';
        labelKey = 'picker_el_link';
        confidence = 'medium';
    }
    // SPAN
    else if (tag === 'span') {
        category = 'text';
        labelEN = 'Text Span';
        labelKey = 'picker_el_text';
        confidence = 'low';
        hintKey = 'picker_hint_text';
    }
    // FORM
    else if (tag === 'form') {
        category = 'container';
        labelEN = 'Form Container';
        labelKey = 'picker_el_form';
        confidence = 'low';
        hintKey = 'picker_hint_form';
    }
    return { category, labelEN, labelKey, confidence, tag, hintKey, hintEN };
};
exports.getElementInfo = getElementInfo;
const generateRobustSelector = (el) => {
    if (!el)
        return null;
    if (el.id && !/\\d{5,}|[-]{2,}|[a-zA-Z0-9]{15,}/.test(el.id))
        return '#' + CSS.escape(el.id);
    if (el.getAttribute('data-testid'))
        return el.tagName.toLowerCase() + '[data-testid="' + el.getAttribute('data-testid') + '"]';
    const attributes = ['name', 'placeholder', 'aria-label'];
    for (const attr of attributes) {
        const val = el.getAttribute(attr);
        if (val && val.length < 50)
            return el.tagName.toLowerCase() + '[' + attr + '="' + CSS.escape(val) + '"]';
    }
    const path = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();
        const parent = current.parentElement;
        if (parent) {
            const children = Array.from(parent.children);
            const index = children.indexOf(current) + 1;
            selector += ':nth-child(' + index + ')';
        }
        path.unshift(selector);
        current = current.parentElement;
        if (path.length > 5)
            break;
    }
    return 'body > ' + path.join(' > ');
};
exports.generateRobustSelector = generateRobustSelector;
