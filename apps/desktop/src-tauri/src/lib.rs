//! Folioviv for the Mac: the owner's back office (today, invoices, books, clients, the shop) in a native window. The window
//! shows the hosted web app, which stays the one place where the screens are written; `tauri-plugin-krizaka` adds what a
//! browser tab cannot: the menu bar with ⌘1–⌘5 to the sections (in the Mac's language), `akinaza://` links that open the
//! same page, and the navigation guard (the window stays on Folioviv's address, other links open in the browser). The
//! hosted page has no capability at all: it cannot call the app, and nothing on the Mac is readable from it.

mod sections;
mod words;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_krizaka::kit::nav_guard::normalize_origin;

/// The deployment the window shows; a build for another one sets `AKINAZA_APP_URL` (read at build time). It is the
/// address the web answers on itself: dev.akinaza.com redirects there, and the guard never follows a hop to another origin.
// @fixed: the product's own address, the one its links name
const DEFAULT_APP_URL: &str = "https://www.akinaza.com";
const WINDOW: &str = "main";
const RELOAD: &str = "view.reload";

fn app_origin() -> String {
    let raw = option_env!("AKINAZA_APP_URL").unwrap_or(DEFAULT_APP_URL);
    normalize_origin(raw).unwrap_or_else(|_| DEFAULT_APP_URL.to_string())
}

pub fn run() {
    let origin = app_origin();
    tauri::Builder::default()
        .plugin(
            tauri_plugin_krizaka::Builder::new("akinaza")
                .link_hosts(["www.akinaza.com", "dev.akinaza.com"])
                .link_prefixes(["/app", "/fr/app", "/en/app"])
                .hosted_origin(&origin)
                .hosted_window(WINDOW)
                .build(),
        )
        .setup(move |app| {
            let locale = words::system_locale();
            tauri_plugin_krizaka::set_menu(app.handle(), &words::menu(locale))?;
            let start = sections::section_url(&origin, None, locale, "section.today").ok_or("the app's address is not valid")?;
            WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::External(start))
                .title("Folioviv")
                .inner_size(1180.0, 780.0)
                .min_inner_size(960.0, 600.0)
                .center()
                // Files dropped on the window are the page's own (an attachment field), never read by the app.
                .disable_drag_drop_handler()
                .build()?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window(WINDOW) else { return };
            if event.id().as_ref() == RELOAD {
                let _ = window.reload();
                return;
            }
            let current = window.url().ok();
            if let Some(url) = sections::section_url(&app_origin(), current.as_ref(), words::system_locale(), event.id().as_ref()) {
                let _ = window.navigate(url);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Folioviv");
}
