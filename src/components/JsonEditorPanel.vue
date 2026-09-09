<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { createJSONEditor, isJSONContent, isTextContent, Mode, stringifyJSONPath, getFocusPath, type MenuItem, type ContextMenuItem, type JSONEditorSelection, type RenderContextMenuContext } from 'vanilla-jsoneditor'
import type { EditorMode, ThemeMode } from '../types'
import { tryParseJson, getValueByPath, getValueType } from '../utils/json'
import { translateEditorMenu, t } from '../i18n'
import MarkdownDialog from './MarkdownDialog.vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  mode?: EditorMode
  theme?: ThemeMode
  label?: string
}>(), {
  modelValue: '{}',
  mode: 'tree',
  theme: 'light',
  label: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:mode': [value: EditorMode]
  'selection-change': [type: 'array' | 'object' | 'none']
  'copied': [text: string]
}>()

const containerRef = ref<HTMLDivElement>()
const editor = shallowRef<ReturnType<typeof createJSONEditor> | null>(null)
const currentSelection = shallowRef<JSONEditorSelection | undefined>(undefined)

// ---------------------------------------------------------------------------
// Navigation bar context menu: right-click a breadcrumb segment -> copy JSON path
// ---------------------------------------------------------------------------
const navMenu = ref({ visible: false, x: 0, y: 0, path: '' })
const navCopied = ref(false)

// ---------------------------------------------------------------------------
// Markdown preview: right-click a long string value -> render it as Markdown
// ---------------------------------------------------------------------------
const MARKDOWN_MIN_LENGTH = 100
const markdownVisible = ref(false)
const markdownContent = ref('')

/**
 * The string value targeted by the context menu, or null when it does not
 * qualify as a Markdown candidate.
 *
 * `context.selection` is authoritative at render time, unlike the reactive
 * `currentSelection` which can still lag behind the click.
 * getFocusPath() yields the owning property path for BOTH key selections and
 * value selections, so right-clicking the key name or the value both work.
 */
function stringValueFromContext(context: RenderContextMenuContext): string | null {
  const sel = context?.selection
  if (!sel || sel.type === 'text') return null
  let path: (string | number)[] | undefined
  try {
    path = getFocusPath(sel as never) as (string | number)[] | undefined
  } catch {
    path = undefined
  }
  if (!path || path.length === 0) return null
  const content = editor.value?.get()
  if (!isJSONContent(content)) return null
  const value = getValueByPath(content.json, path)
  return typeof value === 'string' && value.length > MARKDOWN_MIN_LENGTH ? value : null
}

/** Appends a "Show Markdown" entry when the right-clicked value qualifies. */
function buildContextMenu(items: ContextMenuItem[], context: RenderContextMenuContext): ContextMenuItem[] {
  const translated = translateEditorMenu(items as unknown as MenuItem[]) as unknown as ContextMenuItem[]
  const value = stringValueFromContext(context)
  if (!value) return translated
  const separator: ContextMenuItem = { type: 'separator' }
  const entry: ContextMenuItem = {
    type: 'button',
    text: t('contextMenu.showMarkdown'),
    title: t('contextMenu.showMarkdown'),
    onClick: () => {
      markdownContent.value = value
      markdownVisible.value = true
    },
  }
  return [...translated, separator, entry]
}

/** Authoritative path of the current selection (handles multi-selection too). */
function getSelectionPathArray(): (string | number)[] | null {
  const sel = currentSelection.value as unknown as { type?: string; path?: unknown } | undefined
  if (!sel || sel.type === 'text') return null
  try {
    const p = getFocusPath(sel as never)
    if (Array.isArray(p)) return p as (string | number)[]
  } catch {
    // fall through to the raw path below
  }
  const raw = sel.path
  return Array.isArray(raw) ? (raw as (string | number)[]) : null
}

/**
 * The navigation bar renders one `.jse-navigation-bar-item` per path segment.
 * Item k carries the label `path[k]` and represents the node `path.slice(0, k+1)`
 * (the trailing item, rendered only for objects/arrays, has no label).
 */
function navPathFor(item: HTMLElement): string | null {
  const bar = item.closest('.jse-navigation-bar')
  if (!bar) return null
  const items = Array.from(bar.querySelectorAll<HTMLElement>('.jse-navigation-bar-item'))
  const idx = items.indexOf(item)
  if (idx < 0) return null

  const segs = getSelectionPathArray()
  if (segs) {
    const end = Math.max(0, Math.min(idx + 1, segs.length))
    return stringifyJSONPath(segs.slice(0, end) as never)
  }

  // Fallback: rebuild the path from the breadcrumb labels
  const rebuilt: (string | number)[] = []
  for (let i = 0; i <= idx; i++) {
    const btn = items[i].querySelector<HTMLElement>(
      'button.jse-navigation-bar-button:not(.jse-navigation-bar-arrow)'
    )
    const label = (btn?.textContent ?? '').trim()
    if (!label) continue
    rebuilt.push(/^\d+$/.test(label) ? Number(label) : label)
  }
  return stringifyJSONPath(rebuilt as never)
}

/**
 * Must run in the CAPTURE phase on window: the editor installs its own
 * contextmenu handler on the TreeMode root which calls stopPropagation(),
 * so a listener on our container would never see the event.
 */
function onWindowContextMenu(e: MouseEvent) {
  navCopied.value = false
  const target = e.target as HTMLElement | null
  const item = target?.closest?.('.jse-navigation-bar-item') as HTMLElement | null
  if (!item || !containerRef.value?.contains(item)) {
    closeNavMenu()
    return
  }
  const path = navPathFor(item)
  if (!path) return
  e.preventDefault()
  e.stopPropagation()
  navMenu.value = {
    visible: true,
    x: Math.min(e.clientX, window.innerWidth - 200),
    y: Math.min(e.clientY, window.innerHeight - 100),
    path,
  }
}

function closeNavMenu() {
  if (navMenu.value.visible) navMenu.value.visible = false
}

async function copyNavPath() {
  const text = navMenu.value.path
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for environments without async clipboard access
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  emit('copied', text)
  navCopied.value = true
  window.setTimeout(() => {
    navCopied.value = false
    closeNavMenu()
  }, 700)
}

function buildContent(): { json: unknown } | { text: string } {
  const result = tryParseJson(props.modelValue)
  if (result.success) {
    return { json: result.data }
  }
  return { text: props.modelValue }
}

function initEditor() {
  if (!containerRef.value) return

  editor.value = createJSONEditor({
    target: containerRef.value,
    props: {
      content: buildContent(),
      mode: props.mode as unknown as Mode,
      onChange: (updatedContent: Parameters<typeof isJSONContent>[0]) => {
        if (isJSONContent(updatedContent)) {
          emit('update:modelValue', JSON.stringify(updatedContent.json, null, 2))
        } else if (isTextContent(updatedContent)) {
          emit('update:modelValue', updatedContent.text)
        }
      },
      onChangeMode: (newMode: EditorMode) => {
        emit('update:mode', newMode)
      },
      indentation: 2,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true,
      onRenderMenu: (items: MenuItem[]) => translateEditorMenu(items),
      onRenderContextMenu: (items: ContextMenuItem[], context: RenderContextMenuContext) =>
        buildContextMenu(items, context),
      onSelect: (selection: JSONEditorSelection | undefined) => {
        currentSelection.value = selection
        emit('selection-change', getSelectedType())
      },
    },
  })
}

function destroyEditor() {
  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
}

function setMode(mode: EditorMode) {
  editor.value?.updateProps({ mode: mode as unknown as Mode })
  emit('update:mode', mode)
}

function expandAllNodes() {
  editor.value?.expand([], () => true)
}

function collapseAllNodes() {
  editor.value?.collapse([], true)
}

function format() {
  if (!editor.value) return
  const content = editor.value.get()
  if (isJSONContent(content)) {
    editor.value.set({ json: content.json })
  } else if (isTextContent(content)) {
    try {
      const parsed = JSON.parse(content.text)
      editor.value.set({ json: parsed })
    } catch {
      // Ignore invalid JSON
    }
  }
}

function compact() {
  if (!editor.value) return
  const content = editor.value.get()
  if (isJSONContent(content)) {
    editor.value.set({ text: JSON.stringify(content.json) })
  } else if (isTextContent(content)) {
    try {
      const parsed = JSON.parse(content.text)
      editor.value.set({ text: JSON.stringify(parsed) })
    } catch {
      // Ignore
    }
  }
}

function focus() {
  editor.value?.focus()
}

function getText(): string {
  if (!editor.value) return ''
  const content = editor.value.get()
  if (isTextContent(content)) return content.text
  if (isJSONContent(content)) return JSON.stringify(content.json, null, 2)
  return ''
}

function setText(text: string) {
  if (!editor.value) return
  const result = tryParseJson(text)
  if (result.success) {
    editor.value.set({ json: result.data })
  } else {
    editor.value.set({ text })
  }
}

function get(): unknown {
  if (!editor.value) return null
  const content = editor.value.get()
  if (isJSONContent(content)) return content.json
  return null
}

function getSelectedType(): 'array' | 'object' | 'none' {
  const sel = currentSelection.value
  if (!sel || sel.type === 'text') return 'none'
  const path = (sel as any).path as (string | number)[] | undefined
  if (!path || path.length === 0) return 'none'
  const content = editor.value?.get()
  if (!isJSONContent(content)) return 'none'
  const value = getValueByPath(content.json, path)
  return getValueType(value)
}

function getSelectedValue(): unknown {
  const sel = currentSelection.value
  if (!sel || sel.type === 'text') return undefined
  const path = (sel as any).path as (string | number)[] | undefined
  if (!path || path.length === 0) return undefined
  const content = editor.value?.get()
  if (!isJSONContent(content)) return undefined
  return getValueByPath(content.json, path)
}

function set(json: unknown) {
  editor.value?.set({ json })
}

defineExpose({ setMode, expandAll: expandAllNodes, collapseAll: collapseAllNodes, format, compact, focus, getText, setText, get, set, getSelectedType, getSelectedValue })

watch(() => props.modelValue, (newVal) => {
  if (!editor.value) return
  const content = editor.value.get()
  let currentText = ''
  if (isJSONContent(content)) {
    currentText = JSON.stringify(content.json, null, 2)
  } else if (isTextContent(content)) {
    currentText = content.text
  }
  if (currentText !== newVal) {
    const result = tryParseJson(newVal)
    if (result.success) {
      editor.value.update({ json: result.data })
    } else {
      editor.value.update({ text: newVal })
    }
  }
})

watch(() => props.mode, (newMode) => {
  if (!editor.value) return
  editor.value.updateProps({ mode: newMode as unknown as Mode })
})

onMounted(() => {
  initEditor()
  window.addEventListener('click', closeNavMenu)
  // capture phase: run before the editor's own contextmenu handler
  window.addEventListener('contextmenu', onWindowContextMenu, true)
  window.addEventListener('blur', closeNavMenu)
})

onBeforeUnmount(() => {
  destroyEditor()
  window.removeEventListener('click', closeNavMenu)
  window.removeEventListener('contextmenu', onWindowContextMenu, true)
  window.removeEventListener('blur', closeNavMenu)
})
</script>

<template>
  <div class="json-editor-panel" :class="`theme-${theme}`">
    <div ref="containerRef" class="json-editor-container" />
    <MarkdownDialog v-model:visible="markdownVisible" :content="markdownContent" :theme="theme" />
    <Teleport to="body">
      <div
        v-if="navMenu.visible"
        class="nav-path-menu"
        :style="{ left: navMenu.x + 'px', top: navMenu.y + 'px' }"
        @click.stop
        @contextmenu.prevent.stop
      >
        <div class="nav-path-menu-value" :title="navMenu.path">{{ navMenu.path }}</div>
        <button class="nav-path-menu-item" @click="copyNavPath">
          <svg v-if="!navCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{{ navCopied ? t('toast.copied') : t('path.copyNodePath') }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.json-editor-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.json-editor-container {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.json-editor-container :deep(.jse-main) {
  height: 100%;
  border: none;
}

/* Dark theme overrides via CSS variables */
.theme-dark .json-editor-container :deep(.jse-main) {
  --jse-background-color: #1e1e1e;
  --jse-text-color: #d4d4d4;
  --jse-menu-color: #fff;
  --jse-theme-color: #306eb5;
  --jse-key-color: #9cdcfe;
  --jse-value-color: #d4d4d4;
  --jse-value-color-number: #b5cea8;
  --jse-value-color-boolean: #569cd6;
  --jse-value-color-null: #569cd6;
  --jse-value-color-string: #ce9178;
  --jse-value-color-url: #ce9178;
  --jse-hover-background-color: #343434;
  --jse-selection-background-color: #464646;
  --jse-navigation-bar-background: #656565;
  --jse-navigation-bar-background-highlight: #7e7e7e;
  --jse-panel-button-background-highlight: #7e7e7e;
  --jse-context-menu-background: #4b4b4b;
  --jse-context-menu-background-highlight: #7a7a7a;
  --jse-context-menu-separator-color: #595959;
  --jse-context-menu-pointer-hover-background: hsl(8, 67%, 54%);
  --jse-modal-background: #2f2f2f;
  --jse-modal-overlay-background: rgba(0, 0, 0, 0.5);
  --jse-modal-code-background: #2f2f2f;
  --jse-panel-background: #333333;
  --jse-panel-background-border: 1px solid #464646;
  --jse-panel-border: 1px solid #3c3c3c;
  --jse-input-background: #3d3d3d;
  --jse-input-border: 1px solid #4f4f4f;
  --jse-table-header-background: #333333;
  --jse-table-header-background-highlight: #424242;
  --jse-table-row-odd-background: rgba(255, 255, 255, 0.1);
  --jse-button-background: #808080;
  --jse-button-background-highlight: #7a7a7a;
  --jse-button-color: #e0e0e0;
  --jse-button-secondary-background: #494949;
  --jse-button-secondary-background-highlight: #5d5d5d;
  --jse-a-color: #55abff;
  --jse-a-color-highlight: #4387c9;
  --jse-search-match-background-color: #343434;
  --jse-active-line-background-color: rgba(255, 255, 255, 0.06);
  --jse-tag-background: rgba(0, 0, 0, 0.3);
  --jse-tooltip-background: #4b4b4b;
  --jse-tooltip-border: 1px solid #737373;
  --jse-color-picker-background: #656565;
  --jse-svelte-select-background: #3d3d3d;
  --jse-svelte-select-border: 1px solid #4f4f4f;
}

/* Right-click menu on the navigation bar breadcrumb */
.nav-path-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  max-width: 340px;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
}

.nav-path-menu-value {
  padding: 4px 8px 6px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  font-family: consolas, menlo, monaco, monospace;
  font-size: 11px;
  color: var(--text-secondary, #6b7280);
  word-break: break-all;
  max-height: 56px;
  overflow: hidden;
}

.nav-path-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color, #1a1a1a);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.nav-path-menu-item:hover {
  background: var(--btn-hover-bg, #f3f4f6);
}

.nav-path-menu-item svg {
  flex-shrink: 0;
  opacity: 0.7;
}
</style>
