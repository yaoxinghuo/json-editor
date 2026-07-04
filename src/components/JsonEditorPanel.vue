<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { createJSONEditor, isJSONContent, isTextContent, Mode } from 'vanilla-jsoneditor'
import type { EditorMode, ThemeMode } from '../types'
import { tryParseJson } from '../utils/json'

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
}>()

const containerRef = ref<HTMLDivElement>()
const editor = shallowRef<ReturnType<typeof createJSONEditor> | null>(null)

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

function set(json: unknown) {
  editor.value?.set({ json })
}

defineExpose({ setMode, expandAll: expandAllNodes, collapseAll: collapseAllNodes, format, compact, focus, getText, setText, get, set })

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
})

onBeforeUnmount(() => {
  destroyEditor()
})
</script>

<template>
  <div class="json-editor-panel" :class="`theme-${theme}`">
    <div ref="containerRef" class="json-editor-container" />
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
</style>
