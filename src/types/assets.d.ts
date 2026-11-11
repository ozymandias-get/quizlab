declare module '*.png' {
  const src: string
  export default src
}

/**
 * Component-local stylesheets, imported for their side effect.
 *
 * `src/shared/styles/index.css` is the global sheet; a rendering surface that
 * owns its own markup brings its own scoped rules next to it rather than adding
 * to the global one.
 */
declare module '*.css'
