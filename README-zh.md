# JsonEditor

[English](./README.md) | [中文](./README-zh.md)

一个基于 Tauri、Vue 3 和 [vanilla-jsoneditor](https://github.com/josdejong/jsoneditor) 构建的轻量级跨平台桌面 JSON 编辑器。安装包仅 ~5-10 MB，启动快，内存占用低。支持双面板布局、独立编辑模式、深色/浅色主题及状态持久化。

<img width="1876" height="1200" alt="image" src="https://github.com/user-attachments/assets/81f2232a-e1ff-451c-b1be-65cd9c6a94ad" />

**仓库地址**: https://github.com/yaoxinghuo/json-editor

## 为什么选择 JsonEditor？

- **极致轻量** — 基于 Tauri（Rust 后端）构建，而非 Electron。安装包仅 **~5-10 MB**（Electron 编辑器通常 100+ MB）。内存占用极低，启动迅速，原生性能。
- **无冗余** — 就是一个 JSON 编辑器。无广告、无遥测、无后台服务。

## 功能特性

- **双面板编辑器** — 并排编辑 JSON，支持可拖拽的分隔条和复制按钮（左 → 右 / 右 → 左）
- **多标签页** — 可在标签页中打开并切换多个 JSON 文件，支持未保存指示器和关闭确认
- **左侧文件浏览器** — 树形目录浏览，支持右键上下文菜单（重命名、删除等）
- **最近文件** — 工具栏快速访问最近打开的文件
- **三种视图模式** — 文本、树形、表格模式，每个面板可独立切换
- **中英文双语界面** — 一键切换界面语言，偏好自动记忆
- **深色 / 浅色主题** — 一键切换，偏好自动记忆
- **从文件打开** — 从本地文件系统加载 JSON
- **从 URL 打开** — 粘贴 cURL 命令（支持请求头、方法、请求体）或纯 URL 来加载 JSON
- **保存 / 另存为** — 保存到原文件或导出到新文件
- **单实例模式** — 应用已运行时双击 `.json` 文件，在新标签页中打开（如已打开则切换到对应标签页），而非启动第二个窗口
- **会话恢复** — 启动时恢复上次的会话（打开的标签页、模式、活动标签）
- **智能复制按钮** — 树视图中复制按钮根据当前选中类型动态显示"Array"或"Object"
- **Markdown 预览** — 对长度超过 100 的字符串值右键选择"Show Markdown"，即可打开渲染后的 Markdown 预览，支持代码块语法高亮、语言标签、单块复制及原文复制
- **JSON 工具** — 格式化、压缩、排序、转换、搜索、撤销/重做（每个面板独立）
- **校验与节点计数** — 实时 JSON 校验，面板标题栏显示节点数
- **Invalid JSON 自动修复** — 打开无效 JSON 时自动切换到文本模式，以显示 vanilla-jsoneditor 内置的"Auto repair"按钮
- **大文件友好** — 超过 1.5 MB 的文件默认以文本模式打开；校验和节点计数采用防抖处理，保证响应速度
- **状态持久化** — 重启后记忆窗口位置/大小、主题、分隔比例、编辑模式及编辑器内容

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | [Tauri 2](https://tauri.app) |
| 前端框架 | [Vue 3](https://vuejs.org) + TypeScript |
| 构建工具 | [Vite](https://vitejs.dev) |
| JSON 编辑器 | [vanilla-jsoneditor](https://github.com/josdejong/jsoneditor) |
| 窗口状态持久化 | [tauri-plugin-window-state](https://v2.tauri.app/plugin/window-state/) |
| 前端状态持久化 | 通过自定义 `usePersistedState` 组合式函数使用 `localStorage` |

## 环境要求

- [Node.js](https://nodejs.org) 18+
- [Rust](https://www.rust-lang.org/tools/install)（stable 工具链）
- 平台相关依赖 — 参见 [Tauri 环境要求](https://v2.tauri.app/start/prerequisites/)

## 快速开始

```bash
# 安装依赖
npm install

# 以开发模式运行（启动 Vite 开发服务器 + Tauri 窗口）
npm run tauri dev
```

应用将在 Tauri 窗口中打开 `http://localhost:1420`。

## 构建

```bash
# 构建当前平台的生产包
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 前端开发（仅 Web）

如果只想调试前端而不依赖 Rust/Tauri：

```bash
npm run dev
```

然后在浏览器中打开 `http://localhost:1420`。注意：仅浏览器模式下无法使用 Tauri 特有功能（文件对话框、窗口状态持久化等）。

## 项目结构

```
JsonEditor/
├── src/
│   ├── assets/              # SVG 图标（应用 logo、拖拽指示器）
│   ├── components/
│   │   ├── JsonEditorPanel.vue  # 单个 JSON 编辑面板（封装 vanilla-jsoneditor）
│   │   ├── Toolbar.vue          # 顶部工具栏（新建、打开、保存、另存为、复制、主题切换）
│   │   ├── TabBar.vue           # 多标签页栏（支持关闭确认）
│   │   ├── ConfirmDialog.vue    # 通用确认对话框
│   │   └── OpenUrlModal.vue     # 从 URL/cURL 加载 JSON 的弹窗
│   ├── composables/
│   │   └── usePersistedState.ts # 基于 localStorage 的 Vue ref
│   ├── i18n/
│   │   └── index.ts             # 中英文翻译
│   ├── utils/
│   │   ├── curl.ts              # cURL 命令解析器
│   │   ├── file.ts              # 通过 Tauri 对话框打开/保存文件
│   │   └── json.ts              # JSON 校验、格式化、节点计数
│   ├── types/
│   │   └── index.ts             # 共享 TypeScript 类型
│   ├── App.vue                  # 主应用组件（布局、状态、分栏面板）
│   └── main.ts                  # Vue 应用入口
├── src-tauri/
│   ├── icons/                   # 应用图标（PNG、ICNS、ICO）
│   ├── capabilities/default.json  # Tauri 权限配置
│   ├── src/lib.rs               # Tauri 插件注册
│   ├── Cargo.toml               # Rust 依赖
│   └── tauri.conf.json          # Tauri 配置（窗口、打包等）
├── scripts/
│   └── gen-icons.py             # 图标生成脚本（PNG → 全格式）
├── .github/
│   └── workflows/
│       └── release.yml          # 跨平台构建 CI/CD
├── index.html
├── package.json
└── vite.config.ts
```

## 关于

本项目为开源项目，托管在 GitHub：https://github.com/yaoxinghuo/json-editor

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT
