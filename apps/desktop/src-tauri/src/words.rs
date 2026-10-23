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
}
