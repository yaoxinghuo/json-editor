/**
 * highlight.js ships types for its main entry only, not for the individual
 * language modules under `lib/languages/*`. Without this declaration every
 * `import x from 'highlight.js/lib/languages/x'` fails under `strict`.
 */
declare module 'highlight.js/lib/languages/*' {
  import type { LanguageFn } from 'highlight.js'

  const language: LanguageFn
  export default language
}
