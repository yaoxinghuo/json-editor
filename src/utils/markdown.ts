import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import type { LanguageFn } from 'highlight.js'

// Only register the languages we care about: importing the full `highlight.js`
// bundle would add ~1MB to the app for no benefit here.
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import http from 'highlight.js/lib/languages/http'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import less from 'highlight.js/lib/languages/less'
import makefile from 'highlight.js/lib/languages/makefile'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import powershell from 'highlight.js/lib/languages/powershell'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scss from 'highlight.js/lib/languages/scss'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import vbnet from 'highlight.js/lib/languages/vbnet'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const LANGUAGES: Record<string, LanguageFn> = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  dockerfile,
  go,
  http,
  ini,
  java,
  javascript,
  json,
  kotlin,
  less,
  makefile,
  markdown,
  php,
  plaintext,
  powershell,
  python,
  ruby,
  rust,
  scss,
  shell,
  sql,
  swift,
  typescript,
  vbnet,
  xml,
  yaml,
}

for (const [name, definition] of Object.entries(LANGUAGES)) {
  // Each module also brings its own aliases (js/ts/py/sh/golang/...), so
  // ```js and ```javascript resolve to the same grammar.
  hljs.registerLanguage(name, definition)
}

export interface MarkdownRendererOptions {
  /** Label for the per-code-block copy button (i18n, must be already escaped-safe). */
  copyLabel: string
  /** Label shown for blocks with no/unknown language. */
  plainLabel: string
}

/**
 * Markdown renderer used by the "Show Markdown" dialog.
 *
 * - html: false  -> raw HTML inside the JSON value is escaped (untrusted input).
 * - linkify      -> bare URLs become links.
 * - breaks       -> single newlines become <br>, which suits Windows CRLF values.
 * - highlight    -> fenced/indented code blocks get syntax highlighting.
 */
export function createMarkdownRenderer(options: MarkdownRendererOptions) {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: false,
  })

  // The `highlight` option can only return a string starting with `<pre`
  // (otherwise markdown-it wraps it again), which rules out a header row.
  // Taking over `rules.fence` gives full control over the block markup.
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const info = (token.info || '').trim()
    // ```json title="x" -> language is the first token only.
    const language = (info ? info.split(/\s+/)[0] : '').toLowerCase()
    const known = !!language && !!hljs.getLanguage(language)

    // ignoreIllegals keeps half-broken snippets (very common in log values)
    // from throwing and killing the whole render.
    const body = known
      ? hljs.highlight(token.content, { language, ignoreIllegals: true }).value
      : escapeHtml(token.content)

    const label = known ? language : options.plainLabel
    const cls = language || 'plaintext'

    return (
      `<div class="md-code-wrap">` +
      `<div class="md-code-head">` +
      `<span class="md-code-lang">${escapeHtml(label)}</span>` +
      `<button type="button" class="md-code-copy">${escapeHtml(options.copyLabel)}</button>` +
      `</div>` +
      `<pre class="md-code-block"><code class="hljs language-${escapeHtml(cls)}">${body}</code></pre>` +
      `</div>\n`
    )
  }

  return md
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
