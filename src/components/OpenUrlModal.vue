<script setup lang="ts">
import { ref } from 'vue'
import { parseCurl } from '../utils/curl'

const emit = defineEmits<{
  close: []
  load: [content: string, fileName: string]
}>()

const curlInput = ref('')
const loading = ref(false)
const error = ref('')

async function handleLoad() {
  error.value = ''
  if (!curlInput.value.trim()) {
    error.value = 'Please paste a curl command'
    return
  }

  let parsed
  try {
    parsed = parseCurl(curlInput.value)
  } catch (e) {
    error.value = (e as Error).message
    return
  }

  loading.value = true
  try {
    const resp = await fetch(parsed.url, {
      method: parsed.method,
      headers: parsed.headers,
      body: parsed.body ?? undefined,
    })

    if (!resp.ok) {
      error.value = `HTTP ${resp.status} ${resp.statusText}`
      return
    }

    const text = await resp.text()
    const fileName = parsed.url.split('/').pop()?.split('?')[0] || 'response.json'
    if (!fileName.endsWith('.json')) {
      // Try to extract a reasonable filename from the URL
      const pathPart = new URL(parsed.url).pathname.split('/').pop() || 'response.json'
      const name = pathPart.endsWith('.json') ? pathPart : 'response.json'
      emit('load', text, name)
    } else {
      emit('load', text, fileName)
    }
    emit('close')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal">
      <div class="modal-header">
        <h3>Open from URL</h3>
        <button class="modal-close" title="Close" @click="emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="modal-hint">Paste a curl command below. URL, method, headers (including Authorization), and body will be parsed automatically.</p>
        <textarea
          v-model="curlInput"
          class="curl-input"
          placeholder="curl -X GET 'https://api.example.com/data' -H 'Authorization: Bearer token123'"
          rows="8"
          :disabled="loading"
          @keydown.ctrl.enter="handleLoad"
        />
        <div v-if="error" class="modal-error">{{ error }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')" :disabled="loading">Cancel</button>
        <button class="btn btn-primary" @click="handleLoad" :disabled="loading">
          {{ loading ? 'Loading...' : 'Load' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-color, #fff);
  border-radius: 12px;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color, #1a1a1a);
}

.modal-close {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: var(--btn-hover-bg, #f3f4f6);
}

.modal-body {
  padding: 16px 20px;
  flex: 1;
  overflow: auto;
}

.modal-hint {
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 12px;
}

.curl-input {
  width: 100%;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  resize: vertical;
  background: var(--bg-color, #fff);
  color: var(--text-color, #1a1a1a);
  outline: none;
  transition: border-color 0.15s;
}

.curl-input:focus {
  border-color: var(--jse-theme-color, #3883fa);
}

.curl-input::placeholder {
  color: var(--text-secondary, #9ca3af);
}

.modal-error {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--btn-hover-bg, #f3f4f6);
  color: var(--text-color, #1a1a1a);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--btn-active-bg, #e5e7eb);
}

.btn-primary {
  background: var(--jse-theme-color, #3883fa);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--jse-theme-color-highlight, #2563eb);
}
</style>
