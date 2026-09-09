<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import JsonEditorPanel from './components/JsonEditorPanel.vue'
import Toolbar from './components/Toolbar.vue'
import TabBar from './components/TabBar.vue'
import OpenUrlModal from './components/OpenUrlModal.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import type { EditorMode, ThemeMode, DialogButton } from './types'
import { t } from './i18n'
import {
  openJsonFile,
  saveJsonFile,
  writeJsonFile,
  listJsonFiles,
  renameJsonFile,
  deleteJsonFile,
  revealInFileManager,
  formatSize,
  formatMtime,
  type DirJsonFile,
} from './utils/file'
import { formatJson, compactJson, validateJson, countJsonNodes, tryParseJson } from './utils/json'
import { usePersistedState } from './composables/usePersistedState'

const SAMPLE_JSON = `{\n  "array": [1, 2, 3],\n  "boolean": true,\n  "color": "gold",\n  "null": null,\n  "number": 123,\n  "object": {\n    "a": "b",\n    "c": "d"\n  },\n  "string": "Hello World"\n}`

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
interface EditorTab {
  id: string
  path: string
  name: string
  content: string
  mode: EditorMode
  dirty: boolean
}

const leftTabs = ref<EditorTab[]>([])
const activeLeftTabId = ref<string | null>(null)

// 右侧草稿（不关联文件）
const rightDraft = usePersistedState('rightDraft', SAMPLE_JSON)
const rightMode = usePersistedState<EditorMode>('rightMode', 'tree')

const theme = usePersistedState<ThemeMode>('theme', 'light')

const leftEditorRef = ref<InstanceType<typeof JsonEditorPanel>>()
const rightEditorRef = ref<InstanceType<typeof JsonEditorPanel>>()
const showOpenUrlModal = ref(false)
const leftSelectionType = ref<'array' | 'object' | 'none'>('none')
const rightSelectionType = ref<'array' | 'object' | 'none'>('none')

const unlistenFns: (() => void)[] = []

// ---------------------------------------------------------------------------
// Active tab helpers
// ---------------------------------------------------------------------------
const activeTab = computed(() => leftTabs.value.find(t => t.id === activeLeftTabId.value) ?? null)

const leftContent = computed({
  get: () => activeTab.value?.content ?? SAMPLE_JSON,
  set: (v: string) => {
    if (activeTab.value) {
      activeTab.value.content = v
      activeTab.value.dirty = true
    }
  }
})

const leftMode = computed({
  get: () => activeTab.value?.mode ?? 'tree',
  set: (m: EditorMode) => {
    if (activeTab.value) {
      activeTab.value.mode = m
    }
  }
})

const fileName = computed(() => activeTab.value?.name ?? 'untitled.json')

// Files larger than this are opened in text mode by default, because tree
// mode builds the entire DOM tree and becomes very sluggish on huge JSON.
const LARGE_FILE_BYTES = 1.5 * 1024 * 1024

function pickModeForContent(content: string): EditorMode {
  return content.length > LARGE_FILE_BYTES ? 'text' : 'tree'
}

// ---------------------------------------------------------------------------
// Recent files
// ---------------------------------------------------------------------------
const recentFiles = ref<Array<{ name: string; path: string }>>([])
const RECENT_KEY = 'json-editor-recent-files'
const MAX_RECENT = 50
/** The toolbar dropdown only shows the newest slice of the list. */
const TOOLBAR_RECENT_LIMIT = 20

function loadRecentFiles() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (raw) recentFiles.value = JSON.parse(raw)
  } catch {
    recentFiles.value = []
  }
}

function pushRecentFile(path: string) {
  const name = path.split(/[\\/]/).pop() || path
  const list = recentFiles.value.filter(f => f.path !== path)
  list.unshift({ name, path })
  if (list.length > MAX_RECENT) list.length = MAX_RECENT
  recentFiles.value = list
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // ignore quota errors
  }
}

loadRecentFiles()

// ---------------------------------------------------------------------------
// Folder browser
// ---------------------------------------------------------------------------
const currentDir = ref('')
const dirFiles = ref<DirJsonFile[]>([])
const dirLoading = ref(false)

function getFileDir(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (lastSep <= 0) return ''
  let dir = filePath.substring(0, lastSep)
  if (/^[A-Za-z]:$/.test(dir)) {
    dir = dir + '\\'
  }
  return dir
}

async function loadDirFiles(dirPath: string) {
  if (!dirPath) return
  currentDir.value = dirPath
  dirLoading.value = true
  try {
    // The Rust command also grants fs scope and sorts by modification time.
    dirFiles.value = await listJsonFiles(dirPath)
  } catch (e) {
    console.error('Failed to load directory:', e)
    dirFiles.value = []
  } finally {
    dirLoading.value = false
  }
}

async function openDirForFile(filePath: string) {
  const dir = getFileDir(filePath)
  if (dir) {
    await loadDirFiles(dir)
  } else {
    currentDir.value = ''
    dirFiles.value = []
  }
}

async function refreshCurrentDir() {
  if (!currentDir.value) return
  await loadDirFiles(currentDir.value)
}

async function handleOpenFileFromFolder(file: DirJsonFile) {
  await openFileInTab(file.path)
}

// ---------------------------------------------------------------------------
// File context menu (rename / delete / reveal / copy path)
// ---------------------------------------------------------------------------
const fileMenu = ref<{ visible: boolean; x: number; y: number; file: DirJsonFile | null }>({
  visible: false,
  x: 0,
  y: 0,
  file: null,
})

const FILE_MENU_W = 190
const FILE_MENU_H = 196

function onFileContextMenu(e: MouseEvent, file: DirJsonFile) {
  e.preventDefault()
  e.stopPropagation()
  // Keep the menu inside the viewport
  const x = Math.max(4, Math.min(e.clientX, window.innerWidth - FILE_MENU_W - 4))
  const y = Math.max(4, Math.min(e.clientY, window.innerHeight - FILE_MENU_H - 4))
  fileMenu.value = { visible: true, x, y, file }
}

function closeFileMenu() {
  if (fileMenu.value.visible) fileMenu.value.visible = false
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

// Rename: inline editing in the sidebar, no extra modal
const renamingPath = ref<string | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function startRename(file: DirJsonFile) {
  renamingPath.value = file.path
  renameValue.value = file.name
}

function setRenameInput(el: unknown) {
  renameInput.value = (el as HTMLInputElement) ?? null
  if (el) {
    requestAnimationFrame(() => {
      const input = el as HTMLInputElement
      input.focus()
      // Select only the base name (excluding the trailing ".json") so the user
      // can type to rename without accidentally altering the extension.
      const name = renameValue.value
      const extLen = name.toLowerCase().endsWith('.json') ? 5 : 0
      const baseLen = name.length - extLen
      if (baseLen > 0) {
        input.setSelectionRange(0, baseLen)
      } else {
        input.select()
      }
    })
  }
}

function cancelRename() {
  if (renamingPath.value === null) return
  renamingPath.value = null
}

async function commitRename() {
  const oldPath = renamingPath.value
  if (!oldPath) return
  const newName = renameValue.value.trim()
  renamingPath.value = null
  const oldName = oldPath.split(/[\\/]/).pop() || ''
  if (!newName || newName === oldName) return
  const newPath = oldPath.substring(0, oldPath.length - oldName.length) + newName
  try {
    await renameJsonFile(oldPath, newPath)
    // Keep open tabs in sync with the new path
    const tab = leftTabs.value.find(tb => tb.path === oldPath)
    if (tab) {
      tab.path = newPath
      tab.name = newName
    }
    await loadDirFiles(currentDir.value)
  } catch (e) {
    console.error('Failed to rename:', e)
    showToast(t('file.rename.failed') + '：' + (e instanceof Error ? e.message : String(e)))
  }
}

const pendingDelete = ref<DirJsonFile | null>(null)

async function onFileMenuAction(action: string) {
  const file = fileMenu.value.file
  closeFileMenu()
  if (!file) return
  switch (action) {
    case 'open':
      await openFileInTab(file.path)
      break
    case 'rename':
      startRename(file)
      break
    case 'delete':
      pendingDelete.value = file
      break
    case 'reveal':
      try {
        await revealInFileManager(file.path)
      } catch (e) {
        console.error('Failed to reveal:', e)
      }
      break
    case 'copyPath':
      await copyTextToClipboard(file.path)
      showToast(t('toast.copied'))
      break
  }
}

async function onDeleteAction(key: string) {
  const file = pendingDelete.value
  pendingDelete.value = null
  if (key !== 'delete' || !file) return
  try {
    await deleteJsonFile(file.path)
    // Close the tab if this file was open
    const tab = leftTabs.value.find(tb => tb.path === file.path)
    if (tab) closeTabNow(tab.id)
    await loadDirFiles(currentDir.value)
    showToast(t('file.deleted'))
  } catch (e) {
    console.error('Failed to delete:', e)
    showToast(t('file.delete.failed') + '：' + (e instanceof Error ? e.message : String(e)))
  }
}

// ---------------------------------------------------------------------------
// Tab operations
// ---------------------------------------------------------------------------
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function openFileInTab(path: string, content?: string) {
  // 检查是否已经打开
  const existing = leftTabs.value.find(t => t.path === path)
  if (existing) {
    activeLeftTabId.value = existing.id
    return
  }
  let text = content
  if (text === undefined) {
    try {
      text = await readTextFile(path)
    } catch (e) {
      console.error('Failed to read file:', e)
      alert('无法打开文件：' + path)
      return
    }
  }
  const name = path.split(/[\\/]/).pop() || 'untitled.json'
  const tab: EditorTab = {
    id: generateId(),
    path,
    name,
    content: text,
    mode: pickModeForContent(text),
    dirty: false,
  }
  leftTabs.value.push(tab)
  activeLeftTabId.value = tab.id
  pushRecentFile(path)
  await openDirForFile(path)
}

function closeTabNow(id: string) {
  const idx = leftTabs.value.findIndex(t => t.id === id)
  if (idx === -1) return
  leftTabs.value.splice(idx, 1)
  // 如果关闭的是当前激活的 tab，切换到相邻 tab
  if (activeLeftTabId.value === id) {
    if (leftTabs.value.length === 0) {
      activeLeftTabId.value = null
    } else {
      const newIdx = Math.min(idx, leftTabs.value.length - 1)
      activeLeftTabId.value = leftTabs.value[newIdx].id
    }
  }
}

// Close requests go through here: a dirty tab asks first.
const pendingClose = ref<string | null>(null)

function requestCloseTab(id: string) {
  const tab = leftTabs.value.find(t => t.id === id)
  if (!tab) return
  if (tab.dirty) {
    pendingClose.value = id
    return
  }
  closeTabNow(id)
}

const unsavedTabName = computed(() => {
  const tab = leftTabs.value.find(tb => tb.id === pendingClose.value)
  return tab?.name ?? ''
})

const unsavedButtons = computed<DialogButton[]>(() => [
  { key: 'cancel', label: t('dialog.cancel') },
  { key: 'discard', label: t('dialog.discard') },
  { key: 'save', label: t('dialog.save'), primary: true },
])

async function onUnsavedAction(key: string) {
  const id = pendingClose.value
  if (!id) return
  if (key === 'cancel') {
    pendingClose.value = null
    return
  }
  pendingClose.value = null
  if (key === 'save') {
    activeLeftTabId.value = id
    await handleSave()
    // Save failed or was cancelled via Save As dialog -> keep the tab open
    if (leftTabs.value.find(tb => tb.id === id)?.dirty) return
  }
  closeTabNow(id)
}

const deleteButtons = computed<DialogButton[]>(() => [
  { key: 'cancel', label: t('dialog.cancel') },
  { key: 'delete', label: t('file.delete'), danger: true },
])

function switchTab(id: string) {
  activeLeftTabId.value = id
}

// ---------------------------------------------------------------------------
// Toolbar handlers
// ---------------------------------------------------------------------------
function createNewTab(content = '{}', dirty = true) {
  const tab: EditorTab = {
    id: generateId(),
    path: '',
    name: 'untitled.json',
    content,
    mode: 'tree',
    dirty,
  }
  leftTabs.value.push(tab)
  activeLeftTabId.value = tab.id
}

async function handleNew() {
  createNewTab('{}', true)
}

async function handleOpen() {
  const result = await openJsonFile()
  if (result) {
    await invoke('allow_file', { path: result.path })
    await openFileInTab(result.path, result.content)
  }
}

async function handleOpenRecent(path: string) {
  await invoke('allow_file', { path })
  await openFileInTab(path)
}

async function handleSave() {
  if (!activeTab.value) return
  const tab = activeTab.value
  // 已有路径：直接保存，不弹窗
  if (tab.path) {
    try {
      await writeJsonFile(tab.path, tab.content)
      tab.dirty = false
      pushRecentFile(tab.path)
      await openDirForFile(tab.path)
      showToast(t('toast.saved'))
    } catch (e) {
      console.error('Failed to save file:', e)
      showToast(t('toast.saveFailed') + '：' + (e instanceof Error ? e.message : String(e)))
    }
    return
  }
  // 无路径：弹出另存为
  const path = await saveJsonFile(tab.content, tab.name)
  if (path) {
    tab.path = path
    tab.name = path.split(/[\\/]/).pop() || tab.name
    tab.dirty = false
    pushRecentFile(path)
    await openDirForFile(path)
    showToast(t('toast.saved'))
  }
}

async function handleSaveAs() {
  if (!activeTab.value) return
  const tab = activeTab.value
  const defaultName = tab.name
  const defaultDir = currentDir.value || (tab.path ? getFileDir(tab.path) : undefined)
  const path = await saveJsonFile(tab.content, defaultName, defaultDir)
  if (path) {
    tab.path = path
    tab.name = path.split(/[\\/]/).pop() || tab.name
    tab.dirty = false
    pushRecentFile(path)
    await openDirForFile(path)
  }
}

async function handleOpenUrl() {
  showOpenUrlModal.value = true
}

function handleUrlLoaded(content: string, name: string) {
  // URL 加载也作为 tab 打开（无路径）
  const tab: EditorTab = {
    id: generateId(),
    path: '',
    name,
    content,
    mode: pickModeForContent(content),
    dirty: true,
  }
  leftTabs.value.push(tab)
  activeLeftTabId.value = tab.id
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
  const selType = leftEditorRef.value?.getSelectedType()
  if (selType === 'array' || selType === 'object') {
    const value = leftEditorRef.value?.getSelectedValue()
    rightDraft.value = JSON.stringify(value, null, 2)
  } else {
    rightDraft.value = leftContent.value
  }
}

function copyRightToLeft() {
  const selType = rightEditorRef.value?.getSelectedType()
  if (selType === 'array' || selType === 'object') {
    const value = rightEditorRef.value?.getSelectedValue()
    leftContent.value = JSON.stringify(value, null, 2)
  } else {
    leftContent.value = rightDraft.value
  }
}

function getCopyLeftTitle(): string {
  if (leftSelectionType.value === 'array') return t('copyLeftArrayToRight')
  if (leftSelectionType.value === 'object') return t('copyLeftObjectToRight')
  return t('copyLeftToRight')
}

function getCopyRightTitle(): string {
  if (rightSelectionType.value === 'array') return t('copyRightArrayToLeft')
  if (rightSelectionType.value === 'object') return t('copyRightObjectToLeft')
  return t('copyRightToLeft')
}

// ---------------------------------------------------------------------------
// Drag & drop
// ---------------------------------------------------------------------------
const dragOverLeft = ref(false)
const dragOverRight = ref(false)

async function setupDragDrop() {
  try {
    const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload
      if (payload.type === 'over') {
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
    // non-Tauri env
  }
}

async function loadDroppedFile(path: string, side: 'left' | 'right') {
  try {
    const content = await readTextFile(path)
    if (side === 'left') {
      await openFileInTab(path, content)
    } else {
      rightDraft.value = content
    }
  } catch (e) {
    console.error('Failed to load dropped file:', e)
  }
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
const sidebarWidth = usePersistedState('sidebarWidth', 220)
const sidebarCollapsed = usePersistedState('sidebarCollapsed', false)
const isSidebarDragging = ref(false)

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function startSidebarDrag(e: MouseEvent) {
  e.preventDefault()
  isSidebarDragging.value = true
  const container = document.querySelector('.left-panel') as HTMLElement
  const onMove = (ev: MouseEvent) => {
    if (!container) return
    const rect = container.getBoundingClientRect()
    const width = ev.clientX - rect.left
    sidebarWidth.value = Math.min(320, Math.max(160, width))
  }
  const onUp = () => {
    isSidebarDragging.value = false
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

// Watch active tab to update folder directory
watch(activeLeftTabId, async (newId) => {
  const tab = leftTabs.value.find(t => t.id === newId)
  if (tab?.path) {
    await openDirForFile(tab.path)
  } else {
    currentDir.value = ''
    dirFiles.value = []
  }
  // Recompute validity immediately so the header reflects the switched file
  recomputeLeftValidation()
})

// ---------------------------------------------------------------------------
// File association
// ---------------------------------------------------------------------------
function normalizePath(input: string): string {
  if (input.startsWith('file://')) {
    let p = decodeURIComponent(input.slice('file://'.length))
    if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
    return p
  }
  return input
}

async function loadFileFromPath(rawPath: string) {
  if (activeTab.value?.path === rawPath) return
  try {
    const path = normalizePath(rawPath)
    console.log('[file-association] loading file:', path)
    const content = await readTextFile(path)
    await openFileInTab(path, content)
    console.log('[file-association] file loaded successfully')
  } catch (e) {
    console.error('[file-association] ERROR:', e)
  }
}

async function setupFileAssociation() {
  try {
    const unlisten = await listen<string[]>('opened', (event) => {
      console.log('[file-association] opened event:', event.payload)
      for (const p of event.payload ?? []) {
        loadFileFromPath(p)
      }
    })
    unlistenFns.push(unlisten)

    await new Promise(resolve => setTimeout(resolve, 100))

    const paths = await invoke<string[]>('opened_paths')
    console.log('[file-association] initial paths:', paths)
    for (const p of paths) {
      await loadFileFromPath(p)
    }
  } catch (e) {
    console.log('[file-association] setup failed (expected in browser):', e)
  }
}

// ---------------------------------------------------------------------------
// Menu shortcuts
// ---------------------------------------------------------------------------
async function setupMenuShortcuts() {
  const handlers: Record<string, () => void> = {
    'menu:new': handleNew,
    'menu:open': handleOpen,
    'menu:open_url': handleOpenUrl,
    'menu:save': handleSave,
  }
  for (const [eventName, handler] of Object.entries(handlers)) {
    // The Tauri IPC bridge may not be ready during onMounted; retry once so a
    // failed registration is never silently swallowed.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const unlisten = await listen(eventName, () => handler())
        unlistenFns.push(unlisten)
        break
      } catch (e) {
        if (attempt === 2) {
          console.warn('[menu] listen failed:', eventName, e)
        } else {
          await new Promise(resolve => setTimeout(resolve, 400))
        }
      }
    }
  }
}

async function setupFocusRefresh() {
  try {
    const unlisten = await listen('tauri://focus', () => {
      refreshCurrentDir()
    })
    unlistenFns.push(unlisten)
  } catch (e) {
    // non-Tauri env
  }
}

// ---------------------------------------------------------------------------
// Resizable split panel
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Validation (debounced so large files stay responsive while typing)
// ---------------------------------------------------------------------------
const leftValidation = ref<{ valid: boolean; error: string | null }>({ valid: true, error: null })
const leftNodeCount = ref(0)
const rightValidation = ref<{ valid: boolean; error: string | null }>({ valid: true, error: null })
const rightNodeCount = ref(0)

function recomputeLeftValidation() {
  leftValidation.value = validateJson(leftContent.value)
  leftNodeCount.value = countJsonNodes(leftContent.value)
  // vanilla-jsoneditor's built-in "Auto repair" button is rendered ONLY in
  // text mode (it operates on the raw text). The right draft shows it because
  // it is usually in text mode; the left opens files in tree mode, where the
  // button never appears. Switch to text mode on invalid JSON so the left gets
  // the exact same repair affordance the right draft has.
  if (!leftValidation.value.valid && leftMode.value === 'tree') {
    leftMode.value = 'text'
  }
}

function recomputeRightValidation() {
  rightValidation.value = validateJson(rightDraft.value)
  rightNodeCount.value = countJsonNodes(rightDraft.value)
  if (!rightValidation.value.valid && rightMode.value === 'tree') {
    rightMode.value = 'text'
  }
}

let leftValidationTimer: number | undefined
let rightValidationTimer: number | undefined

// Debounce: typing in a big file no longer triggers a full parse + node walk
// on every keystroke, only once editing settles.
// 同时触发 debounced 的 session 保存：session 的 watch 只监听 id/path/mode/dirty，
// 不监听 content，因此 dirty tab 上后续的内容编辑必须在这里补存，否则退出时
// 若 beforeunload 未可靠触发（Tauri webview 常见），将丢失最新内容。
watch(leftContent, () => {
  if (leftValidationTimer) window.clearTimeout(leftValidationTimer)
  leftValidationTimer = window.setTimeout(recomputeLeftValidation, 300)
  scheduleSessionSave()
}, { flush: 'post' })

watch(rightDraft, () => {
  if (rightValidationTimer) window.clearTimeout(rightValidationTimer)
  rightValidationTimer = window.setTimeout(recomputeRightValidation, 300)
}, { flush: 'post' })

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
const toastMessage = ref('')
let toastTimer: number | undefined

function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 1600)
}

function onNodePathCopied(path: string) {
  showToast(t('toast.nodePathCopied') + ': ' + path)
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
// Registered on `window` in the CAPTURE phase: the vanilla-jsoneditor inner
// handlers (and Tauri's native menu accelerator) would otherwise swallow the
// event before it reaches `document` in the bubble phase.
function onKeyDown(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
  const isS = e.key === 's' || e.key === 'S' || e.code === 'KeyS'
  if (!isS) return
  e.preventDefault()
  e.stopPropagation()
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()
  void handleSave()
}

// ---------------------------------------------------------------------------
// Session persistence (restore last editing state on launch)
// ---------------------------------------------------------------------------
const SESSION_KEY = 'json-editor-session'

interface SessionTab {
  id: string
  path: string
  name: string
  content: string
  mode: EditorMode
  dirty: boolean
  reload?: boolean
}

interface SessionState {
  tabs: SessionTab[]
  activeId: string | null
}

// Persist the open tabs. For files that are saved and unmodified we only store
// the path (reloaded from disk on launch) so huge files never bloat localStorage.
function saveSession() {
  try {
    const tabs = leftTabs.value.map((t) => {
      const isCleanFile = !!t.path && !t.dirty
      return {
        id: t.id,
        path: t.path,
        name: t.name,
        content: isCleanFile ? '' : t.content,
        mode: t.mode,
        dirty: t.dirty,
        reload: isCleanFile,
      }
    })
    localStorage.setItem(SESSION_KEY, JSON.stringify({ tabs, activeId: activeLeftTabId.value }))
  } catch {
    // Quota / serialization errors are non-fatal
  }
}

async function restoreSession(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const state = JSON.parse(raw) as SessionState
    if (!state.tabs || state.tabs.length === 0) return false
    const tabs: EditorTab[] = []
    for (const st of state.tabs) {
      let content = st.content
      let dirty = st.dirty
      if (st.reload && st.path) {
        try {
          content = await readTextFile(st.path)
          dirty = false
        } catch {
          // File moved/deleted: keep the last known content so it can be re-saved
          content = st.content || '{}'
        }
      }
      if (!content) content = '{}'
      tabs.push({
        id: st.id || generateId(),
        path: st.path,
        name: st.name || (st.path ? st.path.split(/[\\/]/).pop() || 'untitled.json' : 'untitled.json'),
        content,
        mode: st.mode || 'tree',
        dirty,
      })
    }
    leftTabs.value = tabs
    const firstId = tabs[0].id
    activeLeftTabId.value =
      state.activeId && tabs.some((t) => t.id === state.activeId) ? state.activeId : firstId
    const active = tabs.find((t) => t.id === activeLeftTabId.value)
    if (active?.path) await openDirForFile(active.path)
    return true
  } catch {
    return false
  }
}

let sessionTimer: number | undefined
function scheduleSessionSave() {
  if (sessionTimer) window.clearTimeout(sessionTimer)
  sessionTimer = window.setTimeout(saveSession, 600)
}

function initApp() {
  // 1. Restore the previous session if one was saved
  void restoreSession().then(async () => {
    // 2. Process file-association / double-click launch arguments
    await setupFileAssociation()
    // 3. If nothing ended up open, start with a fresh new document
    if (leftTabs.value.length === 0) {
      createNewTab('{}', false)
    }
    recomputeLeftValidation()
    recomputeRightValidation()
  })
  setupMenuShortcuts()
  setupFocusRefresh()
  setupDragDrop()
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('click', closeFileMenu)
  window.addEventListener('contextmenu', closeFileMenu, true)
  window.addEventListener('blur', closeFileMenu)
  window.addEventListener('beforeunload', saveSession)
  window.addEventListener('pagehide', saveSession)
}

// Debounced session save on structural / dirty / mode changes (not on every
// keystroke of the content itself, to avoid O(n) work on large files).
watch(
  () => leftTabs.value.map((t) => `${t.id}|${t.path}|${t.mode}|${t.dirty ? 1 : 0}`).join(','),
  scheduleSessionSave
)
watch(activeLeftTabId, scheduleSessionSave)

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(() => {
  document.documentElement.setAttribute('data-theme', theme.value)
  initApp()
})

onBeforeUnmount(() => {
  unlistenFns.forEach(fn => fn())
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('click', closeFileMenu)
  window.removeEventListener('contextmenu', closeFileMenu, true)
  window.removeEventListener('blur', closeFileMenu)
  window.removeEventListener('beforeunload', saveSession)
  window.removeEventListener('pagehide', saveSession)
  if (toastTimer) window.clearTimeout(toastTimer)
  if (sessionTimer) window.clearTimeout(sessionTimer)
})
</script>

<template>
  <div class="app" :data-theme="theme">
    <Toolbar
      :mode="leftMode"
      :theme="theme"
      :file-name="fileName"
      :recent-files="recentFiles.slice(0, TOOLBAR_RECENT_LIMIT)"
      @new="handleNew"
      @open="handleOpen"
      @open-recent="handleOpenRecent"
      @open-url="handleOpenUrl"
      @save="handleSave"
      @save-as="handleSaveAs"
      @copy="handleCopy"
      @format="handleFormat"
      @compact="handleCompact"
      @repair="handleRepair"
      @expand-all="handleExpandAll"
      @collapse-all="handleCollapseAll"
      @toggle-theme="handleToggleTheme"
      @update:mode="(m) => { if (activeTab) activeTab.mode = m }"
    />
    <div class="app-body">
      <div class="left-panel">
        <button
          v-if="sidebarCollapsed"
          class="sidebar-rail"
          :title="t('sidebar.expand')"
          @click="toggleSidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
        <div v-else class="sidebar" :style="{ width: sidebarWidth + 'px' }">
          <div class="sidebar-header">
            <span
              v-if="leftTabs.length > 0"
              class="sidebar-header-path"
              :title="currentDir || t('folder.tempFile')"
            >{{ currentDir || t('folder.tempFile') }}</span>
            <span v-else class="sidebar-header-title">{{ t('sidebar.recentFiles') }}</span>
            <div class="sidebar-header-actions">
              <button
                v-if="leftTabs.length > 0 && currentDir"
                class="sidebar-icon-btn"
                :title="t('folder.refresh')"
                @click="refreshCurrentDir"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
              <button class="sidebar-icon-btn" :title="t('sidebar.collapse')" @click="toggleSidebar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 6 9 12 15 18" />
                </svg>
              </button>
            </div>
          </div>
          <template v-if="leftTabs.length === 0">
            <div class="sidebar-list">
              <div v-if="recentFiles.length === 0" class="sidebar-empty">{{ t('welcome.noRecent') }}</div>
              <div
                v-for="file in recentFiles"
                :key="file.path"
                class="sidebar-item"
                :title="file.path"
                @click="handleOpenRecent(file.path)"
              >
                <span class="sidebar-item-name">{{ file.name }}</span>
                <span class="sidebar-item-path">{{ getFileDir(file.path) || file.path }}</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="folder-list">
              <div v-if="dirLoading" class="folder-empty">{{ t('folder.loading') }}</div>
              <div v-else-if="dirFiles.length === 0" class="folder-empty">{{ t('folder.empty') }}</div>
              <template v-else>
                <div
                  v-for="f in dirFiles"
                  :key="f.path"
                  class="folder-item"
                  :class="{ active: f.path === (activeTab && activeTab.path) }"
                  :title="f.path"
                  @click="handleOpenFileFromFolder(f)"
                  @contextmenu="onFileContextMenu($event, f)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="folder-icon">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <div class="folder-item-main">
                    <input
                      v-if="renamingPath === f.path"
                      :ref="setRenameInput"
                      v-model="renameValue"
                      class="rename-input"
                      @click.stop
                      @blur="commitRename"
                      @keydown.enter.prevent="commitRename"
                      @keydown.esc.prevent="cancelRename"
                    />
                    <span v-else class="folder-item-name">{{ f.name }}</span>
                    <span class="folder-item-meta">{{ formatSize(f.size) }} · {{ formatMtime(f.mtime) }}</span>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
        <div v-if="!sidebarCollapsed" class="sidebar-divider" :class="{ dragging: isSidebarDragging }" @mousedown="startSidebarDrag"></div>
        <div class="main-area">
          <TabBar
            v-if="leftTabs.length > 0"
            :tabs="leftTabs"
            :active-id="activeLeftTabId"
            @select="switchTab"
            @close="requestCloseTab"
          />
          <div class="editor-split" :class="{ 'no-tabs': leftTabs.length === 0 }">
            <div
              class="editor-section"
              :class="{ 'drag-over': dragOverLeft }"
              :style="{ flex: `0 0 calc(${splitRatio * 100}% - ${splitRatio * 40}px)` }"
            >
              <template v-if="leftTabs.length > 0">
                <div class="panel-header panel-header-file">
                  <span class="panel-path" :class="{ 'panel-path-empty': !(activeTab && activeTab.path) }" :title="(activeTab && activeTab.path) ? activeTab.path : t('folder.tempFile')">{{ (activeTab && activeTab.path) ? activeTab.path : t('folder.tempFile') }}</span>
                  <div class="panel-status">
                    <span v-if="leftValidation.valid" class="status-ok">✓ {{ t('panel.valid') }}</span>
                    <span v-else class="status-err">✗ {{ t('panel.invalid') }}</span>
                    <span class="node-count">{{ leftNodeCount }} {{ t('panel.nodes') }}</span>
                  </div>
                </div>
                <JsonEditorPanel
                  ref="leftEditorRef"
                  v-model="leftContent"
                  v-model:mode="leftMode"
                  :theme="theme"
                  label="left"
                  class="editor-wrapper"
                  @selection-change="(t) => leftSelectionType = t"
                  @copied="onNodePathCopied"
                />
              </template>
              <div v-else class="welcome-pane">
                <img class="welcome-pane-logo" src="./assets/json-editor.svg" alt="JsonEditor" />
                <div class="welcome-pane-title">{{ t('welcome.title') }}</div>
                <div class="welcome-pane-hint">{{ t('welcome.subtitle') }}</div>
                <div class="welcome-pane-actions">
                  <button class="welcome-btn primary" @click="handleOpen">{{ t('toolbar.openFile') }}</button>
                  <button class="welcome-btn" @click="handleNew">{{ t('toolbar.new') }}</button>
                </div>
              </div>
            </div>
            <div class="split-divider">
              <div class="split-actions">
                <button
                  class="split-btn"
                  :title="getCopyLeftTitle()"
                  @click="copyLeftToRight"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button
                  class="split-btn"
                  :title="getCopyRightTitle()"
                  @click="copyRightToLeft"
                >
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
                <span class="panel-title">{{ t('panel.draft') }}</span>
                <div class="panel-status">
                  <span v-if="rightValidation.valid" class="status-ok">✓ {{ t('panel.valid') }}</span>
                  <span v-else class="status-err">✗ {{ t('panel.invalid') }}</span>
                  <span class="node-count">{{ rightNodeCount }} {{ t('panel.nodes') }}</span>
                </div>
              </div>
              <JsonEditorPanel
                ref="rightEditorRef"
                v-model="rightDraft"
                v-model:mode="rightMode"
                :theme="theme"
                label="right"
                class="editor-wrapper"
                @selection-change="(t) => rightSelectionType = t"
                @copied="onNodePathCopied"
              />
            </div>
          </div>
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
    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>

    <ConfirmDialog
      v-if="pendingClose"
      :title="t('dialog.unsaved.title')"
      :message="t('dialog.unsaved.message', { name: unsavedTabName })"
      :buttons="unsavedButtons"
      @action="onUnsavedAction"
    />

    <ConfirmDialog
      v-if="pendingDelete"
      variant="danger"
      :title="t('file.delete.title')"
      :message="t('file.delete.confirm', { name: pendingDelete.name })"
      :buttons="deleteButtons"
      @action="onDeleteAction"
    />

    <Teleport to="body">
      <div
        v-if="fileMenu.visible"
        class="file-context-menu"
        :style="{ left: fileMenu.x + 'px', top: fileMenu.y + 'px' }"
        @click.stop
        @contextmenu.prevent.stop
      >
        <button class="fcm-item" @click="onFileMenuAction('open')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>{{ t('file.open') }}</span>
        </button>
        <div class="fcm-sep" />
        <button class="fcm-item" @click="onFileMenuAction('rename')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
          <span>{{ t('file.rename') }}</span>
        </button>
        <button class="fcm-item" @click="onFileMenuAction('copyPath')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{{ t('path.copyPath') }}</span>
        </button>
        <button class="fcm-item" @click="onFileMenuAction('reveal')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{{ t('file.reveal') }}</span>
        </button>
        <div class="fcm-sep" />
        <button class="fcm-item danger" @click="onFileMenuAction('delete')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>{{ t('file.delete') }}</span>
        </button>
      </div>
    </Teleport>
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
  --accent-color: #3b82f6;
  --scrollbar-thumb: #c7c7c7;
  --scrollbar-thumb-hover: #a6a6a6;
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
  --accent-color: #4b9bf4;
  --scrollbar-thumb: #4a4a4a;
  --scrollbar-thumb-hover: #5e5e5e;
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

/* Slim scrollbars everywhere instead of the stock chunky Windows ones */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

::-webkit-scrollbar {
  width: 9px;
  height: 9px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
  background-clip: content-box;
}

/* Consistent keyboard focus indicator */
:focus-visible {
  outline: 2px solid var(--accent-color, #3b82f6);
  outline-offset: 1px;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-width: 0;
}

.editor-split {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-split.no-tabs {
  flex: 1;
}

.editor-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-width: 0;
}

.editor-section.drag-over {
  outline: 2px dashed var(--accent-color, #3b82f6);
  outline-offset: -2px;
  background: rgba(59, 130, 246, 0.05);
}

.welcome-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  overflow-y: auto;
}

.welcome-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 8px;
}

.welcome-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

/* Empty state shown on the left side when no tab is open */
.welcome-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 32px;
  overflow-y: auto;
  user-select: none;
}

.welcome-pane-logo {
  width: 44px;
  height: 44px;
  margin-bottom: 10px;
  opacity: 0.85;
}

.welcome-pane-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.welcome-pane-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 14px;
  text-align: center;
  line-height: 1.6;
}

.welcome-pane-actions {
  display: flex;
  gap: 8px;
}

.welcome-btn {
  padding: 6px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-color);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.welcome-btn:hover {
  background: var(--btn-hover-bg);
}

.welcome-btn.primary {
  background: var(--accent-color, #3b82f6);
  border-color: var(--accent-color, #3b82f6);
  color: #ffffff;
}

.welcome-btn.primary:hover {
  filter: brightness(1.08);
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

.panel-header-file {
  height: 32px;
}

.panel-path {
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  flex: 1;
  min-width: 0;
}

.panel-path-empty {
  opacity: 0.65;
  font-style: italic;
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

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 18px;
  border-radius: 6px;
  background: rgba(17, 24, 39, 0.92);
  color: #ffffff;
  font-size: 13px;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.sidebar-rail {
  width: 22px;
  flex-shrink: 0;
  border: none;
  border-right: 1px solid var(--border-color);
  background: var(--panel-header-bg);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.sidebar-rail:hover {
  background: var(--btn-hover-bg);
  color: var(--text-color);
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--panel-header-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-divider {
  width: 4px;
  cursor: col-resize;
  background: var(--border-color);
  flex-shrink: 0;
  transition: background 0.15s;
}

.sidebar-divider:hover,
.sidebar-divider.dragging {
  background: var(--text-secondary);
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 4px 10px;
  height: 30px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-header-title {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-header-path {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
  user-select: all;
}

.sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.sidebar-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.sidebar-icon-btn:hover {
  background: var(--btn-hover-bg);
  color: var(--text-color);
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  min-width: 0;
  transition: background 0.12s;
}

.sidebar-item:hover {
  background: var(--btn-hover-bg);
}

.sidebar-item-name {
  font-size: 12px;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item-path {
  font-size: 10px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-empty {
  padding: 18px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.6;
}

.folder-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.folder-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-color);
  transition: background 0.12s;
  min-width: 0;
}

.folder-item:hover {
  background: var(--btn-hover-bg);
}

.folder-item.active {
  background: var(--btn-active-bg);
  color: var(--accent-color, #3b82f6);
}

.folder-icon {
  flex-shrink: 0;
  opacity: 0.65;
  margin-top: 1px;
}

.folder-item-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.folder-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-item-meta {
  font-size: 10px;
  color: var(--text-secondary);
  opacity: 0.85;
  white-space: nowrap;
}

.rename-input {
  width: 100%;
  padding: 1px 4px;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-color);
  background: var(--bg-color);
  border: 1px solid var(--accent-color, #3b82f6);
  border-radius: 3px;
  outline: none;
}

.folder-empty {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.6;
}

/* Right-click menu on a folder-list item */
.file-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 180px;
  padding: 4px;
  background: var(--bg-color, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16);
}

.fcm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color, #1a1a1a);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}

.fcm-item:hover {
  background: var(--btn-hover-bg, #f3f4f6);
}

.fcm-item.danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.fcm-item svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.fcm-item.danger:hover svg {
  opacity: 1;
}

.fcm-sep {
  height: 1px;
  background: var(--border-color, #e5e7eb);
  margin: 4px 6px;
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

/* Dark mode: soften the divider between line numbers and editor content */
:root[data-theme="dark"] .jse-text-mode .jse-contents .cm-editor .cm-gutters {
  border-right: 1px solid #2a2a2a !important;
}

/* Dark mode: soften CodeMirror indentation guide lines */
:root[data-theme="dark"] .jse-text-mode .cm-editor {
  --indent-marker-bg-color: #303030;
  --indent-marker-active-bg-color: #3a3a3a;
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
