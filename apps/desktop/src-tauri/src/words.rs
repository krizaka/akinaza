//! The menu bar's words, in the Mac's language (French unless the Mac speaks English): data in `menu/fr.json` and
//! `menu/en.json`, never in code. The hosted page cannot send them (it has no capability), so the app carries them.

use tauri_plugin_krizaka::kit::menu::MenuSpec;

const FR: &str = include_str!("../menu/fr.json");
const EN: &str = include_str!("../menu/en.json");

/// `en` when the Mac's first language is English, `fr` otherwise (Akinaza is made in Québec).
pub fn locale_of(system: Option<&str>) -> &'static str {
    match system {
        Some(tag) if tag.to_ascii_lowercase().starts_with("en") => "en",
        _ => "fr",
    }
}

pub fn system_locale() -> &'static str {
    locale_of(sys_locale::get_locale().as_deref())
}

pub fn menu(locale: &str) -> MenuSpec {
    serde_json::from_str(if locale == "en" { EN } else { FR }).expect("the menu's words are valid JSON")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_mac_s_language_picks_the_words_french_first() {
        assert_eq!(locale_of(Some("en-CA")), "en");
        assert_eq!(locale_of(Some("fr-CA")), "fr");
        assert_eq!(locale_of(Some("es-MX")), "fr");
        assert_eq!(locale_of(None), "fr");
    }

    #[test]
    fn both_menus_pass_the_kit_s_checks_and_name_the_same_items() {
        let (fr, en) = (menu("fr"), menu("en"));
        assert_eq!(fr.validate(), Ok(()));
        assert_eq!(en.validate(), Ok(()));
        let ids = |m: &MenuSpec| m.menus.iter().flat_map(|g| g.items.iter().map(|i| (i.id.clone(), i.accelerator.clone()))).collect::<Vec<_>>();
        assert_eq!(ids(&fr), ids(&en));
        for (id, _) in ids(&fr).into_iter().filter(|(id, _)| id.starts_with("section.")) {
            assert!(crate::sections::SECTIONS.iter().any(|(s, _, _)| *s == id), "{id} has a section");
        }
    }

    /// The « Aller » menu in the web rail's order and words (apps/web lib/app-nav.ts, messages `console.shell`), ⌘1 to ⌘5 (D9).
    fn go(locale: &str) -> Vec<(String, String, Option<String>)> {
        let spec = menu(locale);
        spec.menus[0].items.iter().map(|i| (i.id.clone(), i.label.clone(), i.accelerator.clone())).collect()
    }

    #[test]
    fn the_go_menu_is_the_rail_in_its_order_and_words_in_both_languages() {
        let ids = ["section.today", "section.clients", "section.invoices", "section.books", "section.shop"];
        let keys: Vec<Option<String>> = (1..=5).map(|n| Some(format!("CmdOrCtrl+{n}"))).collect();
        for (locale, title, labels) in [
            ("fr", "Aller", ["Aujourd'hui", "Clients", "Factures", "Livres", "Boutique"]),
            ("en", "Go", ["Today", "Clients", "Invoices", "Books", "Shop"]),
        ] {
            assert_eq!(menu(locale).menus[0].title, title);
            let items = go(locale);
            assert_eq!(items.iter().map(|i| i.0.as_str()).collect::<Vec<_>>(), ids, "{locale}: the rail's order");
            assert_eq!(items.iter().map(|i| i.1.as_str()).collect::<Vec<_>>(), labels, "{locale}: the rail's words");
            assert_eq!(items.iter().map(|i| i.2.clone()).collect::<Vec<_>>(), keys, "{locale}: ⌘1 to ⌘5 in order");
        }
    }
}
