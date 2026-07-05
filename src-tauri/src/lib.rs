use std::sync::Mutex;
use tauri::Manager;
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder};

struct OpenedUrls(Mutex<Vec<tauri::Url>>);

#[tauri::command]
fn opened_urls(app: tauri::AppHandle) -> Vec<tauri::Url> {
    app.state::<OpenedUrls>().0.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(OpenedUrls(Mutex::new(vec![])))
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

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_item)
                .item(&open_item)
                .item(&open_url_item)
                .item(&save_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .build()?;

            app.set_menu(menu)?;

            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                use tauri::Emitter;
                let event_name = match event.id().0.as_str() {
                    "new" => "menu:new",
                    "open" => "menu:open",
                    "open_url" => "menu:open_url",
                    "save" => "menu:save",
                    _ => return,
                };
                let _ = app_handle.emit(event_name, ());
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let tauri::RunEvent::Opened { urls } = event {
                use tauri::Emitter;
                app.state::<OpenedUrls>()
                    .0
                    .lock()
                    .unwrap()
                    .extend(urls.clone());
                let _ = app.emit("opened", urls);
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
            {
                let _ = (app, event);
            }
        });
}
