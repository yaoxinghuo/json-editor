<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { createMarkdownRenderer } from '../utils/markdown'
import { t } from '../i18n'
import hljsLightCss from 'highlight.js/styles/github.css?inline'
import hljsDarkCss from 'highlight.js/styles/github-dark.css?inline'

const props = withDefaults(defineProps<{
  visible?: boolean
  content?: string
  theme?: string
}>(), {
  visible: false,
  content: '',
  theme: 'light',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

// Rebuilt when the UI language changes, so the in-block copy buttons relabel.
const md = computed(() =>
  createMarkdownRenderer({
    copyLabel: t('markdown.copyCode'),
    plainLabel: t('markdown.plaintext'),
  }),
)

/**
 * Only one highlight.js theme may be active at a time (both define `.hljs`),
 * so the active one is injected into <head> and swapped on theme change.
 */
const HLJS_THEME_ID = 'json-editor-hljs-theme'

function applyHighlightTheme(mode: string) {
  let el = document.getElementById(HLJS_THEME_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = HLJS_THEME_ID
    document.head.appendChild(el)
  }
  const css = mode === 'dark' ? hljsDarkCss : hljsLightCss
  if (el.textContent !== css) el.textContent = css
}

/** JSON string values commonly use Windows CRLF ("\r\n"); normalize to LF. */
const normalized = computed(() => (props.content ?? '').replace(/\r\n|\r/g, '\n'))

const renderedHtml = computed(() => md.value.render(normalized.value))

const charCount = computed(() => (props.content ?? '').length)

const copied = ref(false)

function close() {
  emit('update:visible', false)
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback when async clipboard access is unavailable
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

async function copyRaw() {
  if (!(await writeClipboard(normalized.value))) return
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1200)
}

/**
 * Copy buttons live inside v-html output, so they cannot carry Vue handlers --
 * one delegated listener on the body covers every rendered block.
 */
async function onBodyClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  const btn = target?.closest?.('.md-code-copy') as HTMLElement | null
  if (!btn) return

  const code = btn.closest('.md-code-wrap')?.querySelector('code')
  if (!code) return

  if (!(await writeClipboard(code.textContent ?? ''))) return

  const original = btn.textContent
  btn.textContent = t('toast.copied')
  window.setTimeout(() => {
    btn.textContent = original
  }, 1200)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch([() => props.visible, () => props.theme], ([v, mode]) => {
  if (v) {
    copied.value = false
    applyHighlightTheme(mode)
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="md-overlay" @click.self="close">
      <div class="md-dialog" :class="{ 'md-dark': theme === 'dark' }">
        <header class="md-header">
          <span class="md-title">{{ t('markdown.title') }}</span>
          <button class="md-close" :title="t('markdown.close')" @click="close">×</button>
        </header>
        <div class="md-body" v-html="renderedHtml" @click="onBodyClick" />
        <footer class="md-footer">
          <span class="md-meta">{{ charCount }} chars</span>
          <button class="md-btn" @click="copyRaw">
            {{ copied ? t('toast.copied') : t('markdown.copyRaw') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.md-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.md-dialog {
  display: flex;
  flex-direction: column;
  width: min(920px, 100%);
  max-height: 100%;
  background: #ffffff;
  color: #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.md-dialog.md-dark {
  background: #252526;
  color: #d4d4d4;
}

.md-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #e5e7eb;
}

.md-dark .md-header {
  border-bottom-color: #3c3c3c;
}

.md-title {
  font-size: 13px;
  font-weight: 600;
}

.md-close {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  padding: 0 4px;
  cursor: pointer;
  opacity: 0.7;
}

.md-close:hover {
  opacity: 1;
}

.md-body {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.7;
}

.md-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid #e5e7eb;
}

.md-dark .md-footer {
  border-top-color: #3c3c3c;
}

.md-meta {
  font-size: 11px;
  opacity: 0.6;
}

.md-btn {
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: inherit;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.md-btn:hover {
  background: #f3f4f6;
}

.md-dark .md-btn {
  background: #3d3d3d;
  border-color: #4f4f4f;
}

.md-dark .md-btn:hover {
  background: #4b4b4b;
}

/* ---------------------------------------------------------------------------
   Markdown typography.
   Content is injected via v-html, so scoped styles need :deep() to apply.
   --------------------------------------------------------------------------- */
.md-body :deep(> *:first-child) {
  margin-top: 0;
}

.md-body :deep(> *:last-child) {
  margin-bottom: 0;
}

.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4),
.md-body :deep(h5),
.md-body :deep(h6) {
  margin: 20px 0 10px;
  line-height: 1.35;
  font-weight: 600;
}

.md-body :deep(h1) {
  font-size: 22px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}

.md-body :deep(h2) {
  font-size: 18px;
  padding-bottom: 5px;
  border-bottom: 1px solid #e5e7eb;
}

.md-body :deep(h3) {
  font-size: 16px;
}

.md-body :deep(h4) {
  font-size: 14px;
}

.md-body :deep(h5),
.md-body :deep(h6) {
  font-size: 13px;
}

.md-dark :deep(h1),
.md-dark :deep(h2) {
  border-bottom-color: #3c3c3c;
}

.md-body :deep(p) {
  margin: 0 0 12px;
}

.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 0 0 12px;
  padding-left: 24px;
}

.md-body :deep(li) {
  margin: 4px 0;
}

.md-body :deep(li > ul),
.md-body :deep(li > ol) {
  margin: 4px 0;
}

.md-body :deep(blockquote) {
  margin: 0 0 12px;
  padding: 4px 14px;
  border-left: 3px solid #d1d5db;
  color: #6b7280;
}

.md-dark :deep(blockquote) {
  border-left-color: #4f4f4f;
  color: #9ca3af;
}

.md-body :deep(pre) {
  margin: 0 0 12px;
  padding: 12px 14px;
  overflow: auto;
  background: #f6f8fa;
  border-radius: 6px;
}

/* Code blocks are wrapped in a frame with a header row (language + copy). */
.md-body :deep(.md-code-wrap) {
  margin: 0 0 12px;
  border: 1px solid #e8eaed;
  border-radius: 6px;
  overflow: hidden;
}

.md-dark :deep(.md-code-wrap) {
  border-color: #3c3c3c;
}

.md-body :deep(.md-code-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 8px 3px 10px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid #e8eaed;
}

.md-dark :deep(.md-code-head) {
  background: rgba(255, 255, 255, 0.06);
  border-bottom-color: #3c3c3c;
}

.md-body :deep(.md-code-lang) {
  font-family: consolas, menlo, monaco, monospace;
  opacity: 0.7;
}

.md-body :deep(.md-code-copy) {
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.7;
}

.md-body :deep(.md-code-copy:hover) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
  border-color: #d1d5db;
}

.md-dark :deep(.md-code-copy:hover) {
  background: rgba(255, 255, 255, 0.1);
  border-color: #4f4f4f;
}

/* The wrapper owns the frame, so the <pre> inside drops its own. */
.md-body :deep(.md-code-wrap pre) {
  margin: 0;
  border-radius: 0;
}

/* highlight.js themes ship their own background/padding on `.hljs`. The dialog
   owns the frame, so neutralise it -- `.md-body[data-v] pre code.hljs` is more
   specific than the injected `.hljs` rule regardless of stylesheet order. */
.md-body :deep(pre code.hljs) {
  display: block;
  overflow-x: auto;
  padding: 0;
  background: transparent;
}

.md-body :deep(code) {
  font-family: consolas, menlo, monaco, monospace;
  font-size: 12.5px;
}

.md-body :deep(:not(pre) > code) {
  padding: 2px 5px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
}

.md-dark :deep(pre) {
  background: #1b1b1b;
}

.md-dark :deep(:not(pre) > code) {
  background: rgba(255, 255, 255, 0.12);
}

.md-body :deep(a) {
  color: #2563eb;
  text-decoration: none;
}

.md-body :deep(a:hover) {
  text-decoration: underline;
}

.md-dark :deep(a) {
  color: #58a6ff;
}

.md-body :deep(table) {
  margin: 0 0 12px;
  border-collapse: collapse;
}

.md-body :deep(th),
.md-body :deep(td) {
  border: 1px solid #d1d5db;
  padding: 6px 10px;
  text-align: left;
}

.md-body :deep(th) {
  background: rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.md-dark :deep(th),
.md-dark :deep(td) {
  border-color: #4f4f4f;
}

.md-dark :deep(th) {
  background: rgba(255, 255, 255, 0.08);
}

.md-body :deep(hr) {
  margin: 18px 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

.md-dark :deep(hr) {
  border-top-color: #3c3c3c;
}

.md-body :deep(img) {
  max-width: 100%;
}
</style>
