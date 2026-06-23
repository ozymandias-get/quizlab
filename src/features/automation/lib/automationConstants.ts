/**
 * Constants and templates for automation features.
 */

/**
 * Timing constants for the element picker lifecycle.
 * Centralized so tests and tweaks stay in sync and magic numbers don't drift
 * between the renderer hook and the injected script.
 */
export const PICKER_TIMING = {
  /** Delay between submit-click and final cleanup so the user sees the "done" state. */
  CLEANUP_DELAY_MS: 300,
  /** Delay between save success and final teardown so the user sees the green flash. */
  POST_SAVE_DELAY_MS: 500,
  /** Wait after input typing before advancing to the submit step. */
  TYPING_ADVANCE_MS: 120,
  /** Mouse-move label-box rAF coalescing window. */
  LABEL_RAF_FALLBACK_MS: 16,
  /** CSS transition for the click flash effect. */
  CLICK_FLASH_DURATION_MS: 300,
  /** Click flash box-shadow blur radius. */
  CLICK_FLASH_BLUR_PX: 30
} as const

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
