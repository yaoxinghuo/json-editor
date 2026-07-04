import { ref, watch, type Ref } from 'vue'

/**
 * Create a ref that persists its value to localStorage.
 * On init, loads from localStorage; on change, saves to localStorage.
 */
export function usePersistedState<T>(key: string, defaultValue: T): Ref<T> {
  const stored = localStorage.getItem(key)
  const initial = stored !== null ? parseValue(stored, defaultValue) : defaultValue
  const state = ref(initial) as Ref<T>

  watch(
    state,
    (val) => {
      try {
        localStorage.setItem(key, JSON.stringify(val))
      } catch {
        // Ignore quota errors
      }
    },
    { deep: true, immediate: true }
  )

  return state
}

function parseValue<T>(stored: string, defaultValue: T): T {
  try {
    return JSON.parse(stored) as T
  } catch {
    return defaultValue
  }
}
