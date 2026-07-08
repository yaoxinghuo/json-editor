use std::sync::{Mutex, OnceLock};
use tauri::Manager;
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder};

// 全局静态变量存储 opened URLs
// macOS 上 RunEvent::Opened 在 managed state 和 setup 之前触发，
// 所以不能用 managed state，必须用全局静态变量
static OPENED_URLS: OnceLock<Mutex<Vec<tauri::Url>>> = OnceLock::new();

fn opened_urls_lock() -> &'static Mutex<Vec<tauri::Url>> {
    OPENED_URLS.get_or_init(|| Mutex::new(vec![]))
}

#[tauri::command]
fn opened_urls(app: tauri::AppHandle) -> Vec<tauri::Url> {
    use tauri_plugin_fs::FsExt;
    let urls = opened_urls_lock().lock().unwrap().clone();
    // 授权前端读取这些文件（冷启动时 fs_scope 可能还没初始化，这里补授权）
    for url in &urls {
        if let Ok(path) = url.to_file_path() {
            let _ = app.fs_scope().allow_file(&path);
        }
    }
    urls
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![opened_urls])
        .setup(|app| {
            // macOS 自定义菜单：绑定快捷键并通过事件通知前端
            let new_item = MenuItemBuilder::with_id("new", "New")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let open_item = MenuItemBuilder::with_id("open", "Open File")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let open_url_item = MenuItemBuilder::with_id("open_url", "Open from URL")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;
            let save_item = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;
            let minimize_item = MenuItemBuilder::with_id("minimize", "Minimize")
                .accelerator("CmdOrCtrl+M")
                .build(app)?;
            let hide_item = MenuItemBuilder::with_id("hide", "Hide")
                .accelerator("CmdOrCtrl+H")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_item)
                .item(&open_item)
                .item(&open_url_item)
                .item(&save_item)
                .separator()
                .item(&minimize_item)
                .item(&hide_item)
                .item(&quit_item)
                .build()?;

            // Edit 菜单：恢复 macOS 默认的编辑快捷键（Cmd+C/V/X/A）
            // 使用预定义 id，Tauri 会在 webview 中执行对应编辑操作
            let cut_item = MenuItemBuilder::with_id("cut", "Cut")
                .accelerator("CmdOrCtrl+X")
                .build(app)?;
            let copy_item = MenuItemBuilder::with_id("copy", "Copy")
                .accelerator("CmdOrCtrl+C")
                .build(app)?;
            let paste_item = MenuItemBuilder::with_id("paste", "Paste")
                .accelerator("CmdOrCtrl+V")
                .build(app)?;
            let select_all_item = MenuItemBuilder::with_id("select_all", "Select All")
                .accelerator("CmdOrCtrl+A")
                .build(app)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&cut_item)
                .item(&copy_item)
                .item(&paste_item)
                .item(&select_all_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            let app_handle = app.handle().clone();
            app.on_menu_event(move |app, event| {
                use tauri::Emitter;
                match event.id().0.as_str() {
                    "new" => { let _ = app_handle.emit("menu:new", ()); }
                    "open" => { let _ = app_handle.emit("menu:open", ()); }
                    "open_url" => { let _ = app_handle.emit("menu:open_url", ()); }
                    "save" => { let _ = app_handle.emit("menu:save", ()); }
                    "minimize" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.minimize();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => { app.exit(0); }
                    _ => {}
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let tauri::RunEvent::Opened { urls } = event {
                use tauri::Emitter;
                use tauri_plugin_fs::FsExt;
                opened_urls_lock().lock().unwrap().extend(urls.clone());
                // 授权前端读取这些文件
                for url in &urls {
                    if let Ok(path) = url.to_file_path() {
                        let _ = app.fs_scope().allow_file(&path);
                    }
                }
                let _ = app.emit("opened", urls);
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
            {
                let _ = (app, event);
            }
        });
}
