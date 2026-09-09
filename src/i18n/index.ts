import { ref, watch } from 'vue'

export type Lang = 'zh-CN' | 'en-US'

const STORAGE_KEY = 'json-editor-lang'

function loadLang(): Lang {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'zh-CN' || s === 'en-US') return s
  } catch {
    // ignore
  }
  const nav = (navigator.language || 'en-US').toLowerCase()
  return nav.startsWith('zh') ? 'zh-CN' : 'en-US'
}

// 模块级单例：所有组件共享同一语言状态
export const lang = ref<Lang>(loadLang())

watch(
  lang,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {
      // ignore quota errors
    }
    document.documentElement.setAttribute('lang', v)
  },
  { immediate: true }
)

type Dict = Record<string, string>

export const messages: Record<Lang, Dict> = {
  'zh-CN': {
    'toolbar.new': '新建',
    'toolbar.open': '打开',
    'toolbar.openFile': '打开文件',
    'toolbar.openUrl': '从 URL 打开',
    'toolbar.save': '保存',
    'toolbar.copy': '复制',
    'toolbar.about': '关于',
    'toolbar.theme': '切换主题',
    'toolbar.lang': '切换语言',
    'about.version': 'JsonEditor v0.1.9',
    'panel.treeView': '树视图',
    'panel.valid': '有效',
    'panel.invalid': '无效',
    'panel.nodes': '个节点',
    'modal.title': '从 URL 打开',
    'modal.close': '关闭',
    'modal.hint': '在下方粘贴 curl 命令，系统会自动解析 URL、请求方法、请求头（含 Authorization）与请求体。',
    'modal.placeholder': "curl -X GET 'https://api.example.com/data' -H 'Authorization: Bearer token123'",
    'modal.emptyError': '请粘贴 curl 命令',
    'modal.cancel': '取消',
    'modal.load': '加载',
    'modal.loading': '加载中…',
    'toolbar.saveAs': '另存为',
    'toolbar.recentFiles': '最近打开',
    'toolbar.noRecentFiles': '无最近文件',
    'folder.title': '当前文件夹',
    'folder.empty': '无 JSON 文件',
    'folder.loading': '加载中…',
    'folder.tempFile': '临时文件',
    'folder.refresh': '刷新',
    'welcome.title': '欢迎使用 JsonEditor',
    'welcome.subtitle': '打开文件或使用最近打开的文件开始编辑',
    'welcome.recentFiles': '最近打开的文件',
    'welcome.noRecent': '没有最近打开的文件',
    'panel.draft': '草稿',
    'copyLeftArrayToRight': '复制左数组 → 右',
    'copyLeftObjectToRight': '复制左对象 → 右',
    'copyRightArrayToLeft': '复制右数组 → 左',
    'copyRightObjectToLeft': '复制右对象 → 左',
    'path.copyPath': '复制路径',
    'path.copyNodePath': '复制节点路径',
    'path.untitled': '未保存',
    'toast.saved': '已保存',
    'toast.saveFailed': '保存失败',
    'toast.copied': '路径已复制',
    'toast.nodePathCopied': '节点路径已复制',
    'dialog.unsaved.title': '尚未保存',
    'dialog.unsaved.message': '是否保存对「{name}」的修改？',
    'dialog.save': '保存',
    'dialog.discard': '不保存',
    'dialog.cancel': '取消',
    'file.rename': '重命名',
    'file.delete': '删除',
    'file.reveal': '在文件管理器中显示',
    'file.open': '打开',
    'file.rename.title': '重命名',
    'file.rename.placeholder': '新文件名',
    'file.rename.empty': '文件名不能为空',
    'file.rename.failed': '重命名失败',
    'file.delete.title': '删除文件',
    'file.delete.confirm': '确定要删除「{name}」吗？此操作不可撤销。',
    'file.delete.failed': '删除失败',
    'file.deleted': '已删除',
    'sidebar.collapse': '收起侧边栏',
    'sidebar.expand': '展开侧边栏',
    'sidebar.recentFiles': '最近打开',
    'sidebar.folder': '当前文件夹',
    'contextMenu.showMarkdown': '显示为 Markdown',
    'markdown.title': 'Markdown 预览',
    'markdown.copyRaw': '复制原文',
    'markdown.copyCode': '复制代码',
    'markdown.plaintext': '纯文本',
    'markdown.close': '关闭',
  },
  'en-US': {
    'toolbar.new': 'New',
    'toolbar.open': 'Open',
    'toolbar.openFile': 'Open File',
    'toolbar.openUrl': 'Open from URL',
    'toolbar.save': 'Save',
    'toolbar.saveAs': 'Save As',
    'toolbar.copy': 'Copy',
    'toolbar.about': 'About',
    'toolbar.theme': 'Toggle Theme',
    'toolbar.lang': 'Switch Language',
    'toolbar.recentFiles': 'Recent Files',
    'toolbar.noRecentFiles': 'No recent files',
    'about.version': 'JsonEditor v0.1.9',
    'panel.treeView': 'Tree View',
    'panel.valid': 'Valid',
    'panel.invalid': 'Invalid',
    'panel.nodes': 'nodes',
    'panel.draft': 'Draft',
    'modal.title': 'Open from URL',
    'modal.close': 'Close',
    'modal.hint': 'Paste a curl command below. URL, method, headers (including Authorization), and body will be parsed automatically.',
    'modal.placeholder': "curl -X GET 'https://api.example.com/data' -H 'Authorization: Bearer token123'",
    'modal.emptyError': 'Please paste a curl command',
    'modal.cancel': 'Cancel',
    'modal.load': 'Load',
    'modal.loading': 'Loading...',
    'folder.title': 'Current Folder',
    'folder.empty': 'No JSON files',
    'folder.loading': 'Loading…',
    'folder.tempFile': 'Temporary File',
    'folder.refresh': 'Refresh',
    'welcome.title': 'Welcome to JsonEditor',
    'welcome.subtitle': 'Open a file or use recent files to start editing',
    'welcome.recentFiles': 'Recent Files',
    'welcome.noRecent': 'No recent files',
    'copyLeftArrayToRight': 'Copy Left Array → Right',
    'copyLeftObjectToRight': 'Copy Left Object → Right',
    'copyRightArrayToLeft': 'Copy Right Array → Left',
    'copyRightObjectToLeft': 'Copy Right Object → Left',
    'path.copyPath': 'Copy Path',
    'path.copyNodePath': 'Copy Node Path',
    'path.untitled': 'Untitled',
    'toast.saved': 'Saved',
    'toast.saveFailed': 'Save failed',
    'toast.copied': 'Path copied',
    'toast.nodePathCopied': 'Node path copied',
    'dialog.unsaved.title': 'Unsaved Changes',
    'dialog.unsaved.message': 'Do you want to save changes to "{name}"?',
    'dialog.save': 'Save',
    'dialog.discard': "Don't Save",
    'dialog.cancel': 'Cancel',
    'file.rename': 'Rename',
    'file.delete': 'Delete',
    'file.reveal': 'Reveal in File Manager',
    'file.open': 'Open',
    'file.rename.title': 'Rename',
    'file.rename.placeholder': 'New file name',
    'file.rename.empty': 'File name cannot be empty',
    'file.rename.failed': 'Rename failed',
    'file.delete.title': 'Delete File',
    'file.delete.confirm': 'Delete "{name}"? This cannot be undone.',
    'file.delete.failed': 'Delete failed',
    'file.deleted': 'Deleted',
    'sidebar.collapse': 'Collapse sidebar',
    'sidebar.expand': 'Expand sidebar',
    'sidebar.recentFiles': 'Recent Files',
    'sidebar.folder': 'Current Folder',
    'contextMenu.showMarkdown': 'Show Markdown',
    'markdown.title': 'Markdown Preview',
    'markdown.copyRaw': 'Copy Raw Text',
    'markdown.copyCode': 'Copy Code',
    'markdown.plaintext': 'Plain Text',
    'markdown.close': 'Close',
  },
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[lang.value]
  const raw = dict[key] ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  )
}

export function toggleLang() {
  lang.value = lang.value === 'zh-CN' ? 'en-US' : 'zh-CN'
}

// ---------------------------------------------------------------------------
// vanilla-jsoneditor internal menu translations
// ---------------------------------------------------------------------------
// The editor does not expose a `translations` prop.  We hook into
// `onRenderMenu` and `onRenderContextMenu` to replace button text/title.

const zhMenu: Dict = {
  // main menu bar
  Undo: '撤销',
  Redo: '重做',
  Format: '格式化',
  Compact: '压缩',
  Transform: '转换',
  Sort: '排序',
  'Search & replace': '查找与替换',
  Search: '查找',
  Replace: '替换',
  Copy: '复制',
  Cut: '剪切',
  Paste: '粘贴',
  Delete: '删除',
  Duplicate: '复制行',
  Insert: '插入',
  Edit: '编辑',
  'Expand all': '全部展开',
  'Collapse all': '全部折叠',
  'Select all': '全选',
  Remove: '删除',
  Extract: '提取',
  'Enforce string': '强制字符串',
  'Move up': '上移',
  'Move down': '下移',
  'Copy value': '复制值',
  'Copy path': '复制路径',
  'Paste as JSON': '粘贴为 JSON',
  'Paste as string': '粘贴为字符串',
  'Clear': '清空',
  Repair: '修复',
  'Open in tree mode': '在树模式打开',
  'Open in text mode': '在文本模式打开',
  'Open the document in tree mode. Tree mode can handle large documents.': '在树模式打开文档。树模式可处理大文件。',
  'Open the document in text mode. This may freeze or crash your browser.': '在文本模式打开文档。大文件可能导致浏览器卡顿或崩溃。',
  'Cancel opening this large document.': '取消打开这个大文档。',
  'Cancel repair': '取消修复',
  'Repair manually': '手动修复',
  'Leave as is': '保持原样',
  'Repair manually instead': '改为手动修复',
  'No thanks': '不，谢谢',
  'Apply': '应用',
  Ok: '确定',
  Cancel: '取消',
  Close: '关闭',
  'Close this message': '关闭此消息',
  'Auto repair': '自动修复',
  'Automatically repair JSON': '自动修复 JSON',
  'Apply fixed JSON': '应用修复后的 JSON',
  'Move to the parse error location': '跳转到解析错误位置',
  'Scroll to the error location': '滚动到错误位置',
  'Accept the repaired document': '接受修复后的文档',
  'Open anyway': '仍要打开',
  'Sort array or object contents': '排序数组或对象内容',
  'Transform array or object contents (filter, sort, project)': '转换数组或对象内容（筛选、排序、投影）',
  'Transform contents (filter, sort, project)': '转换内容（筛选、排序、投影）',
  'Duplicate row': '复制行',
  'Duplicate the current row (Ctrl+D)': '复制当前行',
  'Duplicate selected contents (Ctrl+D)': '复制所选内容',
  'Remove current row': '删除当前行',
  'Remove selected contents (Delete)': '删除所选内容',
  'Edit the current row': '编辑当前行',
  'Edit the key (Double-click on the key)': '编辑键（双击键）',
  'Edit the value (Double-click on the value)': '编辑值（双击值）',
  'Insert a row after the current row': '在当前行后插入',
  'Insert a row before the current row': '在当前行前插入',
  'Select area after current entry to insert or paste contents': '选择当前条目之后区域以插入或粘贴内容',
  'Select area before current entry to insert or paste contents': '选择当前条目之前区域以插入或粘贴内容',
  'Keep the JSON embedded in the value': '保持 JSON 内嵌在值中',
  'Replace the value with the pasted JSON': '用粘贴的 JSON 替换值',
  'Paste the text as JSON instead of a single value': '将文本作为 JSON 粘贴而非单个值',
  'Paste the clipboard data as a single string value instead of an array': '将剪贴板数据作为单个字符串值粘贴，而非数组',
  'Keep the pasted content as a single value': '将粘贴内容保持为单个值',
  'Keep the pasted array': '保留粘贴的数组',
  'Paste as JSON instead': '改为粘贴为 JSON',
  'Paste as string instead': '改为粘贴为字符串',
  'Paste clipboard contents (Ctrl+V)': '粘贴剪贴板内容',
  'Cut selected contents, formatted with indentation (Ctrl+X)': '剪切所选内容（带缩进）',
  'Cut selected contents, without indentation (Ctrl+Shift+X)': '剪切所选内容（无缩进）',
  'Copy selected contents, formatted with indentation (Ctrl+C)': '复制所选内容（带缩进）',
  'Copy selected contents, without indentation (Ctrl+Shift+C)': '复制所选内容（无缩进）',
  'Copy compacted': '复制压缩结果',
  'Copy formatted': '复制格式化结果',
  'Cut compacted': '剪切压缩结果',
  'Cut formatted': '剪切格式化结果',
  'Format JSON: add proper indentation and new lines (Ctrl+I)': '格式化 JSON：添加适当缩进和换行',
  'Compact JSON: remove all white spacing and new lines (Ctrl+Shift+I)': '压缩 JSON：移除所有空白和换行',
  'Copying and pasting': '复制与粘贴',
  'Show me': '显示',
  Table: '表格',
  Text: '文本',
  Tree: '树',
  // mode switcher labels
  'Switch to table mode (current mode: ': '切换到表格模式（当前：',
  'Switch to text mode (current mode: ': '切换到文本模式（当前：',
  'Switch to tree mode (current mode: ': '切换到树模式（当前：',
  'Core schema meta-schema': '核心 schema 元模式',
  'Enforce keeping the value as string when it contains a numeric value': '当值包含数字时强制保持为字符串',
}

const enMenu: Dict = {
  Undo: 'Undo',
  Redo: 'Redo',
  Format: 'Format',
  Compact: 'Compact',
  Transform: 'Transform',
  Sort: 'Sort',
  'Search & replace': 'Search & replace',
  Search: 'Search',
  Replace: 'Replace',
  Copy: 'Copy',
  Cut: 'Cut',
  Paste: 'Paste',
  Delete: 'Delete',
  Duplicate: 'Duplicate',
  Insert: 'Insert',
  Edit: 'Edit',
  'Expand all': 'Expand all',
  'Collapse all': 'Collapse all',
  'Select all': 'Select all',
  Remove: 'Remove',
  Extract: 'Extract',
  'Enforce string': 'Enforce string',
  'Move up': 'Move up',
  'Move down': 'Move down',
  'Copy value': 'Copy value',
  'Copy path': 'Copy path',
  'Paste as JSON': 'Paste as JSON',
  'Paste as string': 'Paste as string',
  'Clear': 'Clear',
  Repair: 'Repair',
  'Open in tree mode': 'Open in tree mode',
  'Open in text mode': 'Open in text mode',
  'Open the document in tree mode. Tree mode can handle large documents.': 'Open the document in tree mode. Tree mode can handle large documents.',
  'Open the document in text mode. This may freeze or crash your browser.': 'Open the document in text mode. This may freeze or crash your browser.',
  'Cancel opening this large document.': 'Cancel opening this large document.',
  'Cancel repair': 'Cancel repair',
  'Repair manually': 'Repair manually',
  'Leave as is': 'Leave as is',
  'Repair manually instead': 'Repair manually instead',
  'No thanks': 'No thanks',
  'Apply': 'Apply',
  Ok: 'Ok',
  Cancel: 'Cancel',
  Close: 'Close',
  'Close this message': 'Close this message',
  'Auto repair': 'Auto repair',
  'Automatically repair JSON': 'Automatically repair JSON',
  'Apply fixed JSON': 'Apply fixed JSON',
  'Move to the parse error location': 'Move to the parse error location',
  'Scroll to the error location': 'Scroll to the error location',
  'Accept the repaired document': 'Accept the repaired document',
  'Open anyway': 'Open anyway',
  'Sort array or object contents': 'Sort array or object contents',
  'Transform array or object contents (filter, sort, project)': 'Transform array or object contents (filter, sort, project)',
  'Transform contents (filter, sort, project)': 'Transform contents (filter, sort, project)',
  'Duplicate row': 'Duplicate row',
  'Duplicate the current row (Ctrl+D)': 'Duplicate the current row (Ctrl+D)',
  'Duplicate selected contents (Ctrl+D)': 'Duplicate selected contents (Ctrl+D)',
  'Remove current row': 'Remove current row',
  'Remove selected contents (Delete)': 'Remove selected contents (Delete)',
  'Edit the current row': 'Edit the current row',
  'Edit the key (Double-click on the key)': 'Edit the key (Double-click on the key)',
  'Edit the value (Double-click on the value)': 'Edit the value (Double-click on the value)',
  'Insert a row after the current row': 'Insert a row after the current row',
  'Insert a row before the current row': 'Insert a row before the current row',
  'Select area after current entry to insert or paste contents': 'Select area after current entry to insert or paste contents',
  'Select area before current entry to insert or paste contents': 'Select area before current entry to insert or paste contents',
  'Keep the JSON embedded in the value': 'Keep the JSON embedded in the value',
  'Replace the value with the pasted JSON': 'Replace the value with the pasted JSON',
  'Paste the text as JSON instead of a single value': 'Paste the text as JSON instead of a single value',
  'Paste the clipboard data as a single string value instead of an array': 'Paste the clipboard data as a single string value instead of an array',
  'Keep the pasted content as a single value': 'Keep the pasted content as a single value',
  'Keep the pasted array': 'Keep the pasted array',
  'Paste as JSON instead': 'Paste as JSON instead',
  'Paste as string instead': 'Paste as string instead',
  'Paste clipboard contents (Ctrl+V)': 'Paste clipboard contents (Ctrl+V)',
  'Cut selected contents, formatted with indentation (Ctrl+X)': 'Cut selected contents, formatted with indentation (Ctrl+X)',
  'Cut selected contents, without indentation (Ctrl+Shift+X)': 'Cut selected contents, without indentation (Ctrl+Shift+X)',
  'Copy selected contents, formatted with indentation (Ctrl+C)': 'Copy selected contents, formatted with indentation (Ctrl+C)',
  'Copy selected contents, without indentation (Ctrl+Shift+C)': 'Copy selected contents, without indentation (Ctrl+Shift+C)',
  'Copy compacted': 'Copy compacted',
  'Copy formatted': 'Copy formatted',
  'Cut compacted': 'Cut compacted',
  'Cut formatted': 'Cut formatted',
  'Format JSON: add proper indentation and new lines (Ctrl+I)': 'Format JSON: add proper indentation and new lines (Ctrl+I)',
  'Compact JSON: remove all white spacing and new lines (Ctrl+Shift+I)': 'Compact JSON: remove all white spacing and new lines (Ctrl+Shift+I)',
  'Copying and pasting': 'Copying and pasting',
  'Show me': 'Show me',
  Table: 'Table',
  Text: 'Text',
  Tree: 'Tree',
  'Switch to table mode (current mode: ': 'Switch to table mode (current mode: ',
  'Switch to text mode (current mode: ': 'Switch to text mode (current mode: ',
  'Switch to tree mode (current mode: ': 'Switch to tree mode (current mode: ',
  'Core schema meta-schema': 'Core schema meta-schema',
  'Enforce keeping the value as string when it contains a numeric value': 'Enforce keeping the value as string when it contains a numeric value',
}

export const editorMenuMessages: Record<Lang, Dict> = {
  'zh-CN': zhMenu,
  'en-US': enMenu,
}

export function editorMenuT(key: string): string {
  const dict = editorMenuMessages[lang.value]
  return dict[key] ?? key
}

// ---------------------------------------------------------------------------
// vanilla-jsoneditor internal menu translations
// ---------------------------------------------------------------------------
// The editor does not expose a `translations` prop.  We hook into
// `onRenderMenu` and `onRenderContextMenu` to replace button text/title.
type MenuItem =
  | { type: 'button'; text?: string; title?: string; [k: string]: any }
  | { type: 'dropdown-button'; main?: any; items?: any[]; [k: string]: any }
  | { type: 'label'; text?: string; [k: string]: any }
  | { type: 'separator'; [k: string]: any }
  | { type: 'space'; [k: string]: any }
  | { type: 'row'; items?: any[]; [k: string]: any }
  | { type: 'column'; items?: any[]; [k: string]: any }

function translateMenuItem(item: MenuItem): MenuItem {
  if (!item || item.type === 'separator' || item.type === 'space' || item.type === 'label') {
    return item
  }
  if (item.type === 'button') {
    return {
      ...item,
      text: item.text ? editorMenuT(item.text) : item.text,
      title: item.title ? editorMenuT(item.title) : item.title,
    }
  }
  if (item.type === 'dropdown-button') {
    const main = item.main ? translateMenuItem(item.main as MenuItem) : item.main
    const items = (item.items || []).map((sub: MenuItem) => translateMenuItem(sub))
    return { ...item, main, items }
  }
  if (item.type === 'row') {
    const items = (item.items || []).map((sub: MenuItem) => translateMenuItem(sub))
    return { ...item, items }
  }
  if (item.type === 'column') {
    const items = (item.items || []).map((sub: MenuItem) => translateMenuItem(sub))
    return { ...item, items }
  }
  return item
}

export function translateEditorMenu(items: MenuItem[]): MenuItem[] {
  return items.map((item) => translateMenuItem(item))
}
