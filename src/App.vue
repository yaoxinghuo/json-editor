<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import JsonEditorPanel from './components/JsonEditorPanel.vue'
import Toolbar from './components/Toolbar.vue'
import OpenUrlModal from './components/OpenUrlModal.vue'
import type { EditorMode, ThemeMode } from './types'
import { openJsonFile, saveJsonFile } from './utils/file'
import { formatJson, compactJson, validateJson, countJsonNodes, tryParseJson } from './utils/json'
import { usePersistedState } from './composables/usePersistedState'

const SAMPLE_JSON = `{\n  "array": [1, 2, 3],\n  "boolean": true,\n  "color": "gold",\n  "null": null,\n  "number": 123,\n  "object": {\n    "a": "b",\n    "c": "d"\n  },\n  "string": "Hello World"\n}`

const leftContent = usePersistedState('leftContent', SAMPLE_JSON)
const rightContent = usePersistedState('rightContent', SAMPLE_JSON)
const leftMode = usePersistedState<EditorMode>('leftMode', 'text')
const rightMode = usePersistedState<EditorMode>('rightMode', 'tree')
const theme = usePersistedState<ThemeMode>('theme', 'light')
const fileName = ref('untitled.json')

const leftEditorRef = ref<InstanceType<typeof JsonEditorPanel>>()
const rightEditorRef = ref<InstanceType<typeof JsonEditorPanel>>()
const showOpenUrlModal = ref(false)

const unlistenFns: (() => void)[] = []

onMounted(() => {
  document.documentElement.setAttribute('data-theme', theme.value)
  setupFileAssociation()
  setupMenuShortcuts()
  setupDragDrop()
})

onBeforeUnmount(() => {
  unlistenFns.forEach(fn => fn())
})

async function setupMenuShortcuts() {
  try {
    const handlers: Record<string, () => void> = {
      'menu:new': handleNew,
      'menu:open': handleOpen,
      'menu:open_url': handleOpenUrl,
      'menu:save': handleSave,
    }
    for (const [eventName, handler] of Object.entries(handlers)) {
      const unlisten = await listen(eventName, () => handler())
      unlistenFns.push(unlisten)
    }
  } catch (e) {
    // 非 Tauri 环境忽略
  }
}

async function setupDragDrop() {
  try {
    const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload
      if (payload.type === 'over') {
        // 根据鼠标 x 坐标判断落在左侧还是右侧
        const container = document.querySelector('.editor-split') as HTMLElement
        if (container) {
          const rect = container.getBoundingClientRect()
          const isLeft = payload.position.x < rect.left + rect.width * splitRatio.value
          dragOverLeft.value = isLeft
          dragOverRight.value = !isLeft
        }
      } else if (payload.type === 'drop') {
        dragOverLeft.value = false
        dragOverRight.value = false
        if (payload.paths.length > 0) {
          const container = document.querySelector('.editor-split') as HTMLElement
          const isLeft = container
            ? payload.position.x < container.getBoundingClientRect().left + container.getBoundingClientRect().width * splitRatio.value
            : true
          loadDroppedFile(payload.paths[0], isLeft ? 'left' : 'right')
        }
      } else {
        dragOverLeft.value = false
        dragOverRight.value = false
      }
    })
    unlistenFns.push(unlisten)
  } catch (e) {
    // 非 Tauri 环境忽略
  }
}

async function loadDroppedFile(path: string, side: 'left' | 'right') {
  try {
    const content = await readTextFile(path)
    if (side === 'left') {
      leftContent.value = content
      fileName.value = path.split('/').pop() || 'untitled.json'
      await nextTick()
      leftEditorRef.value?.setText(content)
    } else {
      rightContent.value = content
      await nextTick()
      rightEditorRef.value?.setText(content)
    }
  } catch (e) {
    console.error('Failed to load dropped file:', e)
  }
}

// 处理通过文件关联打开的 JSON 文件
function fileUrlToPath(url: string): string {
  // file:// URL 转为文件路径
  if (url.startsWith('file://')) {
    return decodeURIComponent(url.slice(7))
  }
  return url
}

async function loadFileFromUrl(url: string) {
  if (fileLoaded) return
  fileLoaded = true
  try {
    const path = fileUrlToPath(url)
    console.log('[file-association] loading file:', path)
    const content = await readTextFile(path)
    leftContent.value = content
    fileName.value = path.split('/').pop() || 'untitled.json'
    // 确保 editor 已初始化并同步内容
    await nextTick()
    leftEditorRef.value?.setText(content)
    console.log('[file-association] file loaded successfully')
  } catch (e) {
    console.error('Failed to open associated file:', e)
    fileLoaded = false
  }
}

let fileLoaded = false

async function setupFileAssociation() {
  try {
    // 先注册 listener，防止 RunEvent::Opened 事件被错过
    const unlisten = await listen<string[]>('opened', (event) => {
      console.log('[file-association] opened event:', event.payload)
      if (event.payload && event.payload.length > 0) {
        loadFileFromUrl(event.payload[0])
      }
    })
    unlistenFns.push(unlisten)

    // 冷启动：RunEvent::Opened 可能在 app 启动后延迟触发
    // 轮询 opened_urls，覆盖不同时序
    for (let i = 0; i < 10; i++) {
      if (fileLoaded) break
      await new Promise(resolve => setTimeout(resolve, 200))
      const urls = await invoke<string[]>('opened_urls')
      console.log(`[file-association] poll #${i} URLs:`, urls)
      if (urls.length > 0) {
        await loadFileFromUrl(urls[0])
        break
      }
    }
  } catch (e) {
    console.log('[file-association] setup failed (expected in browser):', e)
  }
}

const leftValidation = computed(() => validateJson(leftContent.value))
const leftNodeCount = computed(() => countJsonNodes(leftContent.value))
const rightValidation = computed(() => validateJson(rightContent.value))
const rightNodeCount = computed(() => countJsonNodes(rightContent.value))

// Resizable split panel
const splitRatio = usePersistedState('splitRatio', 0.5)
const isDragging = ref(false)

function startDrag(e: MouseEvent) {
  e.preventDefault()
  isDragging.value = true
  const onMove = (ev: MouseEvent) => {
    const container = document.querySelector('.editor-split') as HTMLElement
    if (!container) return
    const rect = container.getBoundingClientRect()
    const ratio = (ev.clientX - rect.left) / rect.width
    splitRatio.value = Math.min(0.9, Math.max(0.1, ratio))
  }
  const onUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleNew() {
  leftContent.value = '{}'
  fileName.value = 'untitled.json'
  fileLoaded = false
}

async function handleOpen() {
  try {
    const result = await openJsonFile()
    if (result) {
      leftContent.value = result.content
      fileName.value = result.path.split('/').pop() || 'untitled.json'
      fileLoaded = false
    }
  } catch (e) {
    console.error('Failed to open file:', e)
  }
}

async function handleSave() {
  try {
    const path = await saveJsonFile(leftContent.value, fileName.value)
    if (path) {
      fileName.value = path.split('/').pop() || fileName.value
    }
  } catch (e) {
    console.error('Failed to save file:', e)
  }
}

async function handleOpenUrl() {
  showOpenUrlModal.value = true
}

function handleUrlLoaded(content: string, name: string) {
  leftContent.value = content
  fileName.value = name
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(leftContent.value)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}

function handleFormat() {
  try {
    leftContent.value = formatJson(leftContent.value)
  } catch (e) {
    console.error('Failed to format:', e)
  }
}

function handleCompact() {
  try {
    leftContent.value = compactJson(leftContent.value)
  } catch (e) {
    console.error('Failed to compact:', e)
  }
}

function handleRepair() {
  let text = leftContent.value
  text = text.replace(/,\s*([}\]])/g, '$1')
  text = text.replace(/'/g, '"')
  const result = tryParseJson(text)
  if (result.success) {
    leftContent.value = JSON.stringify(result.data, null, 2)
  } else {
    console.error('Failed to repair:', result.error)
  }
}

function handleExpandAll() {
  leftEditorRef.value?.expandAll()
  rightEditorRef.value?.expandAll()
}

function handleCollapseAll() {
  leftEditorRef.value?.collapseAll()
  rightEditorRef.value?.collapseAll()
}

function handleToggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme.value)
}

function copyLeftToRight() {
  rightContent.value = leftContent.value
}

function copyRightToLeft() {
  leftContent.value = rightContent.value
}

// 拖放文件高亮状态（由 Tauri onDragDropEvent 驱动）
const dragOverLeft = ref(false)
const dragOverRight = ref(false)
</script>

<template>
  <div class="app" :data-theme="theme">
    <Toolbar
      :mode="leftMode"
      :theme="theme"
      :file-name="fileName"
      @new="handleNew"
      @open="handleOpen"
      @open-url="handleOpenUrl"
      @save="handleSave"
      @copy="handleCopy"
      @format="handleFormat"
      @compact="handleCompact"
      @repair="handleRepair"
      @expand-all="handleExpandAll"
      @collapse-all="handleCollapseAll"
      @toggle-theme="handleToggleTheme"
      @update:mode="(m) => { leftMode = m; rightMode = m }"
    />
    <div class="editor-split">
      <div
        class="editor-section"
        :class="{ 'drag-over': dragOverLeft }"
        :style="{ flex: `0 0 calc(${splitRatio * 100}% - ${splitRatio * 40}px)` }"
      >
        <div class="panel-header">
          <span class="panel-title">{{ fileName }}</span>
          <div class="panel-status">
            <span v-if="leftValidation.valid" class="status-ok">✓ Valid</span>
            <span v-else class="status-err">✗ Invalid</span>
            <span class="node-count">{{ leftNodeCount }} nodes</span>
          </div>
        </div>
        <JsonEditorPanel
          ref="leftEditorRef"
          v-model="leftContent"
          v-model:mode="leftMode"
          :theme="theme"
          label="left"
          class="editor-wrapper"
        />
      </div>
      <div class="split-divider">
        <div class="split-actions">
          <button class="split-btn" title="Copy Left → Right" @click="copyLeftToRight">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button class="split-btn" title="Copy Right → Left" @click="copyRightToLeft">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
        <div class="split-drag-handle" :class="{ dragging: isDragging }" @mousedown="startDrag">
          <svg class="drag-indicator" width="4" height="19" viewBox="0 0 4 19" fill="currentColor"><g transform="translate(-300 -755)"><rect width="2" height="1" transform="translate(300 755)" /><rect width="2" height="1" transform="translate(300 763)" /><rect width="2" height="1" transform="translate(300 757)" /><rect width="2" height="1" transform="translate(300 759)" /><rect width="2" height="1" transform="translate(300 761)" /><rect width="2" height="1" transform="translate(300 765)" /><rect width="2" height="1" transform="translate(300 773)" /><rect width="2" height="1" transform="translate(300 767)" /><rect width="2" height="1" transform="translate(300 769)" /><rect width="2" height="1" transform="translate(300 771)" /><rect width="2" height="1" transform="translate(302 755)" /><rect width="2" height="1" transform="translate(302 763)" /><rect width="2" height="1" transform="translate(302 757)" /><rect width="2" height="1" transform="translate(302 759)" /><rect width="2" height="1" transform="translate(302 761)" /><rect width="2" height="1" transform="translate(302 765)" /><rect width="2" height="1" transform="translate(302 773)" /><rect width="2" height="1" transform="translate(302 767)" /><rect width="2" height="1" transform="translate(302 769)" /><rect width="2" height="1" transform="translate(302 771)" /></g></svg>
        </div>
      </div>
      <div
        class="editor-section"
        :class="{ 'drag-over': dragOverRight }"
        :style="{ flex: `0 0 calc(${(1 - splitRatio) * 100}% - ${(1 - splitRatio) * 40}px)` }"
      >
        <div class="panel-header">
          <span class="panel-title">Tree View</span>
          <div class="panel-status">
            <span v-if="rightValidation.valid" class="status-ok">✓ Valid</span>
            <span v-else class="status-err">✗ Invalid</span>
            <span class="node-count">{{ rightNodeCount }} nodes</span>
          </div>
        </div>
        <JsonEditorPanel
          ref="rightEditorRef"
          v-model="rightContent"
          v-model:mode="rightMode"
          :theme="theme"
          label="right"
          class="editor-wrapper"
        />
      </div>
    </div>
    <div v-if="!leftValidation.valid && leftValidation.error" class="error-bar">
      <span class="error-icon">⚠</span>
      <span class="error-text">{{ leftValidation.error }}</span>
    </div>
    <OpenUrlModal
      v-if="showOpenUrlModal"
      @close="showOpenUrlModal = false"
      @load="handleUrlLoaded"
    />
  </div>
</template>

<style>
:root {
  --bg-color: #ffffff;
  --toolbar-bg: #f8f9fa;
  --text-color: #1a1a1a;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
  --btn-hover-bg: #f3f4f6;
  --btn-active-bg: #e5e7eb;
  --panel-header-bg: #f8f9fa;
}

:root[data-theme="dark"] {
  --bg-color: #1e1e1e;
  --toolbar-bg: #2d2d2d;
  --text-color: #d4d4d4;
  --text-secondary: #858585;
  --border-color: #3c3c3c;
  --btn-hover-bg: #343434;
  --btn-active-bg: #464646;
  --panel-header-bg: #2d2d2d;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg-color);
  color: var(--text-color);
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.editor-split {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.editor-section.drag-over {
  outline: 2px dashed var(--accent-color, #3b82f6);
  outline-offset: -2px;
  background: rgba(59, 130, 246, 0.05);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 32px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.panel-title {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.panel-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
}

.panel-status .status-ok {
  color: #22c55e;
}

.panel-status .status-err {
  color: #ef4444;
}

.panel-status .node-count {
  color: var(--text-secondary);
}

.editor-wrapper {
  flex: 1;
  overflow: hidden;
}

.split-divider {
  width: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--toolbar-bg);
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
}

.split-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  align-items: center;
  flex: 0 0 25%;
  flex-shrink: 0;
  width: 100%;
}

.split-drag-handle {
  flex: 1;
  width: 100%;
  cursor: col-resize;
  position: relative;
  transition: background 0.15s;
}

.split-drag-handle:hover,
.split-drag-handle.dragging {
  background: var(--btn-hover-bg);
}

.split-drag-handle::before {
  content: '';
  position: absolute;
  top: 20%;
  bottom: 20%;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: var(--border-color);
  opacity: 0.6;
  border-radius: 1px;
  transition: opacity 0.15s;
}

.split-drag-handle:hover::before,
.split-drag-handle.dragging::before {
  opacity: 1;
}

.drag-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-secondary);
  opacity: 0.5;
  transition: opacity 0.15s;
  pointer-events: none;
  fill: currentColor;
}

.split-drag-handle:hover .drag-indicator,
.split-drag-handle.dragging .drag-indicator {
  opacity: 1;
}

.split-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.split-btn:hover {
  background: var(--btn-hover-bg);
  color: var(--text-color);
}

.error-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
  flex-shrink: 0;
}

:root[data-theme="dark"] .error-bar {
  background: #451a03;
  border-top: 1px solid #7c2d12;
  color: #fbbf24;
}

.error-icon {
  font-size: 16px;
}

/* vanilla-jsoneditor dark theme overrides */
:root[data-theme="dark"] .jse-main {
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

/* Dark mode: CodeMirror punctuation/bracket color fix */
:root[data-theme="dark"] .jse-text-mode .cm-content,
:root[data-theme="dark"] .jse-text-mode .cm-line {
  color: #d4d4d4;
}

/* Dark mode: tree mode punctuation/bracket/index color fix */
:root[data-theme="dark"] .jse-tree-mode .jse-bracket,
:root[data-theme="dark"] .jse-tree-mode .jse-expand,
:root[data-theme="dark"] .jse-tree-mode .jse-meta,
:root[data-theme="dark"] .jse-tree-mode .jse-meta-inner,
:root[data-theme="dark"] .jse-tree-mode .jse-index,
:root[data-theme="dark"] .jse-tree-mode .jse-separator {
  color: rgba(255, 255, 255, 0.6);
}

/* Remove default #d7d7d7 side borders from jsoneditor panels */
.jse-contents,
.jse-status-bar,
.jse-navigation-bar {
  border-left: none !important;
  border-right: none !important;
}

.jse-contents:last-child {
  border-bottom: none !important;
}

:root[data-theme="dark"] .jse-status-bar {
  border-bottom-color: #3c3c3c !important;
}
</style>