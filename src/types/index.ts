export type EditorMode = 'tree' | 'text' | 'table'

export type ThemeMode = 'light' | 'dark'

export interface EditorPanelData {
  content: string
  mode: EditorMode
}

export interface StatusInfo {
  line: number
  column: number
  count: number
  isValid: boolean
  error: string | null
}
