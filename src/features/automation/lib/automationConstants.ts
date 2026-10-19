/**
 * Constants and templates for automation features.
 */

export const PICKER_TRANSLATION_KEYS = [
  'picker_step',
  'picker_done_btn',
  'picker_intro_title',
  'picker_intro_text',
  'picker_typing_title',
  'picker_typing_text',
  'picker_submit_title',
  'picker_submit_text',
  'picker_completed',
  'picker_saving',
  'picker_good_choice',
  'picker_maybe',
  'picker_wrong',
  'picker_hint_input_correct',
  'picker_hint_submit_correct',
  'picker_hint_button_send',
  'picker_hint_div_input',
  'picker_hint_textarea_perfect',
  'picker_hint_generic_box',
  'picker_hint_icon',
  'picker_hint_text',
  'picker_hint_form',
  'picker_hint_clickable',
  'picker_el_input',
  'picker_el_submit',
  'picker_el_input_field',
  'picker_el_msg_box',
  'picker_el_button',
  'picker_el_msg_area',
  'picker_el_clickable',
  'picker_el_container',
  'picker_el_icon',
  'picker_el_link',
  'picker_el_text',
  'picker_el_form'
] as const

export const PICKER_SCRIPTS = {
  RESET: 'delete window._aiPickerResult; delete window._aiPickerCancelled;',
  CLEANUP:
    'if (window._aiPickerCleanup) window._aiPickerCleanup(); delete window._aiPickerResult; delete window._aiPickerCancelled;'
}
