<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { EditorMode, ThemeMode } from '../types'

defineProps<{
  mode: EditorMode
  theme: ThemeMode
  fileName: string
}>()

const emit = defineEmits<{
  new: []
  open: []
  openUrl: []
  save: []
  copy: []
  format: []
  compact: []
  expandAll: []
  collapseAll: []
  sort: []
  repair: []
  'toggle-theme': []
  'update:mode': [mode: EditorMode]
}>()

const showOpenMenu = ref(false)
const showAbout = ref(false)

const PROJECT_URL = 'https://github.com/yaoxinghuo/json-editor'

function toggleOpenMenu() {
  showOpenMenu.value = !showOpenMenu.value
}

function closeOpenMenu() {
  showOpenMenu.value = false
}

function handleDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.open-dropdown')) {
    closeOpenMenu()
  }
  if (!target.closest('.about-dropdown')) {
    showAbout.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <img class="app-logo" src="../assets/json-editor.svg" alt="JsonEditor" />
      <button class="btn btn-icon" title="New (Ctrl/Cmd+N)" @click="emit('new')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span>New</span>
      </button>
      <div class="open-dropdown">
        <button class="btn btn-icon" title="Open" @click="toggleOpenMenu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Open</span>
          <svg class="dropdown-arrow" :class="{ open: showOpenMenu }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div v-if="showOpenMenu" class="dropdown-menu" @click.stop>
          <button class="dropdown-item" @click="() => { closeOpenMenu(); emit('open') }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Open File</span>
            <span class="shortcut-hint">Ctrl/Cmd+O</span>
          </button>
          <button class="dropdown-item" @click="() => { closeOpenMenu(); emit('openUrl') }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>Open from URL</span>
            <span class="shortcut-hint">Ctrl/Cmd+Shift+O</span>
          </button>
        </div>
      </div>
      <button class="btn btn-icon" title="Save File (Ctrl/Cmd+S)" @click="emit('save')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>Save</span>
      </button>
      <button class="btn btn-icon" title="Copy to Clipboard" @click="emit('copy')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>Copy</span>
      </button>
      <!-- <div class="divider" />
      <button class="btn btn-icon" title="Format JSON" @click="emit('format')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="3" y1="18" x2="18" y2="18" />
        </svg>
        <span>Format</span>
      </button> -->
      <!-- <button class="btn btn-icon" title="Compact JSON" @click="emit('compact')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span>Compact</span>
      </button> -->
      <!-- <button class="btn btn-icon" title="Repair JSON" @click="emit('repair')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <span>Repair</span>
      </button> -->
      <!-- <div class="divider" />
      <button class="btn btn-icon" title="Expand All" @click="emit('expandAll')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button> -->
      <!-- <button class="btn btn-icon" title="Collapse All" @click="emit('collapseAll')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button> -->
    </div>

    <div class="toolbar-right">
      <!-- <div class="mode-switcher">
        <button
          v-for="m of modes"
          :key="m.value"
          class="mode-btn"
          :class="{ active: mode === m.value }"
          @click="emit('update:mode', m.value)"
        >
          {{ m.label }}
        </button>
      </div>
      <div class="divider" /> -->
      <button class="btn btn-theme" title="Toggle Theme" @click="emit('toggle-theme')">
        <svg v-if="theme === 'light'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </button>
      <div class="divider" />
      <div class="about-dropdown">
        <button class="btn btn-icon" title="About" @click="showAbout = !showAbout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.6"/>
            <circle cx="12" cy="7.6" r="1.05" fill="currentColor"/>
            <rect x="11" y="10.5" width="2" height="6.6" rx="0.6" fill="currentColor"/>
          </svg>
        </button>
        <div v-if="showAbout" class="dropdown-menu about-menu" @click.stop>
          <div class="about-content">
            <img class="about-logo" src="../assets/json-editor.svg" alt="JsonEditor" />
            <div class="about-text">
              <div class="about-title">JsonEditor v0.1.1</div>
              <a class="about-link" :href="PROJECT_URL" target="_blank" rel="noopener">{{ PROJECT_URL }}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 44px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 8px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-logo {
  width: 24px;
  height: 24px;
  margin-right: 4px;
  flex-shrink: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn:hover {
  background: var(--btn-hover-bg);
}

.btn:active {
  background: var(--btn-active-bg);
}

.btn-icon svg {
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 4px;
}

.mode-switcher {
  display: flex;
  gap: 2px;
  background: var(--btn-hover-bg);
  border-radius: 6px;
  padding: 2px;
}

.mode-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.mode-btn.active {
  background: var(--btn-active-bg);
  color: var(--text-color);
  font-weight: 500;
}

.btn-theme {
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.open-dropdown {
  position: relative;
}

.dropdown-arrow {
  transition: transform 0.15s;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--bg-color, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 180px;
  z-index: 100;
  padding: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-color, #1a1a1a);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--btn-hover-bg, #f3f4f6);
}

.shortcut-hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-secondary, #999);
  white-space: nowrap;
}

.about-dropdown {
  position: relative;
}

.about-menu {
  right: 0;
  left: auto;
  min-width: 280px;
  padding: 12px;
}

.about-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.about-logo {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.about-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.about-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.about-link {
  font-size: 12px;
  color: var(--accent-color, #3b82f6);
  text-decoration: none;
  word-break: break-all;
  transition: opacity 0.15s;
}

.about-link:hover {
  opacity: 0.8;
}
</style>
