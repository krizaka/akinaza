//! Where each section of the owner's back office lives: the web's own paths (the URL is the state). In a shop's page
//! (`/fr/app/<shop>/…`) a section stays in that shop; elsewhere the web's short address (`/fr/app/invoices`) opens it in
//! the shop last worked in.

use url::Url;

/// The menu's sections, in the web rail's order (D9): the id the menu sends, the shop page's segment (`shopRoutes` of the web),
/// the short address's segment (the web's `(legacy)` pages, which open the shop last worked in). Checked against the web's
/// pages by `apps/web/lib/app-addresses.test.ts`.
pub const SECTIONS: [(&str, &str, &str); 5] = [
    ("section.today", "today", ""),
    ("section.clients", "clients", "clients"),
    ("section.invoices", "invoices", "invoices"),
    ("section.books", "books", "books"),
    ("section.shop", "settings", "shop"),
];

fn is_shop_id(segment: &str) -> bool {
    let parts: Vec<&str> = segment.split('-').collect();
    parts.iter().map(|p| p.len()).eq([8, 4, 4, 4, 12])
        && parts
            .iter()
            .all(|p| p.chars().all(|c| c.is_ascii_hexdigit()))
}

/// The language of the page on screen (`/en/app/…`), else the one given.
pub fn locale_of<'a>(current: Option<&Url>, fallback: &'a str) -> &'a str {
    match current
        .and_then(|u| u.path_segments()?.next().map(str::to_string))
        .as_deref()
    {
        Some("en") => "en",
        Some("fr") => "fr",
        _ => fallback,
    }
}

/// The address of a section on `base`, from the page on screen (its language and its shop) or the given language.
pub fn section_url(base: &str, current: Option<&Url>, locale: &str, section: &str) -> Option<Url> {
    let (_, in_shop, short) = SECTIONS.iter().find(|(id, _, _)| *id == section)?;
    let mut url = Url::parse(base).ok()?;
    let current = current.filter(|c| c.origin() == url.origin());
    let locale = if locale_of(current, locale) == "en" {
        "en"
    } else {
        "fr"
    };
    let segments: Vec<String> = current
        .and_then(|c| c.path_segments().map(|s| s.map(str::to_string).collect()))
        .unwrap_or_default();
    let shop = match segments.as_slice() {
        [_, app, shop, ..] if app == "app" && is_shop_id(shop) => Some(shop.clone()),
        _ => None,
    };
    let path = match (shop, short.is_empty()) {
        (Some(shop), _) => format!("/{locale}/app/{shop}/{in_shop}"),
        (None, true) => format!("/{locale}/app"),
        (None, false) => format!("/{locale}/app/{short}"),
    };
    url.set_path(&path);
    Some(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    const BASE: &str = "https://www.akinaza.com";
    const SHOP: &str = "0f8c2a3e-1b2c-4d5e-8f90-123456789abc";

    #[test]
    fn without_a_shop_page_the_short_address_opens_the_shop_last_worked_in() {
        assert_eq!(
            section_url(BASE, None, "fr", "section.today")
                .unwrap()
                .as_str(),
            "https://www.akinaza.com/fr/app"
        );
        assert_eq!(
            section_url(BASE, None, "en", "section.invoices")
                .unwrap()
                .as_str(),
            "https://www.akinaza.com/en/app/invoices"
        );
        assert_eq!(
            section_url(BASE, None, "de", "section.books")
                .unwrap()
                .as_str(),
            "https://www.akinaza.com/fr/app/books"
        );
    }

    #[test]
    fn in_a_shop_page_a_section_stays_in_that_shop_and_its_language() {
        let here = Url::parse(&format!("{BASE}/en/app/{SHOP}/clients/42")).unwrap();
        assert_eq!(
            section_url(BASE, Some(&here), "fr", "section.today")
                .unwrap()
                .as_str(),
            format!("{BASE}/en/app/{SHOP}/today")
        );
        assert_eq!(
            section_url(BASE, Some(&here), "fr", "section.books")
                .unwrap()
                .as_str(),
            format!("{BASE}/en/app/{SHOP}/books")
        );
    }

    #[test]
    fn a_page_elsewhere_or_a_segment_that_is_not_a_shop_names_no_shop() {
        let other = Url::parse(&format!("https://evil.example/fr/app/{SHOP}/books")).unwrap();
        assert_eq!(
            section_url(BASE, Some(&other), "fr", "section.books")
                .unwrap()
                .as_str(),
            format!("{BASE}/fr/app/books")
        );
        let profile = Url::parse(&format!("{BASE}/fr/app/profile")).unwrap();
        assert_eq!(
            section_url(BASE, Some(&profile), "en", "section.clients")
                .unwrap()
                .as_str(),
            format!("{BASE}/fr/app/clients")
        );
    }

    #[test]
    fn knows_only_its_sections_and_a_real_base() {
        assert!(section_url(BASE, None, "fr", "section.admin").is_none());
        assert!(section_url("not a url", None, "fr", "section.today").is_none());
    }

    #[test]
    fn each_section_opens_the_rail_s_address_in_both_languages() {
        for locale in ["fr", "en"] {
            let here = Url::parse(&format!("{BASE}/{locale}/app/{SHOP}/clients")).unwrap();
            let at = |section: &str| {
                section_url(BASE, Some(&here), "fr", section)
                    .unwrap()
                    .path()
                    .to_string()
            };
            assert_eq!(
                [
                    "section.today",
                    "section.clients",
                    "section.invoices",
                    "section.books",
                    "section.shop"
                ]
                .map(at),
                ["today", "clients", "invoices", "books", "settings"]
                    .map(|s| format!("/{locale}/app/{SHOP}/{s}")),
                "{locale}: in a shop, the web's shopRoutes"
            );
            let short = |section: &str| {
                section_url(BASE, None, locale, section)
                    .unwrap()
                    .path()
                    .to_string()
            };
            assert_eq!(
                [
                    "section.today",
                    "section.clients",
                    "section.invoices",
                    "section.books",
                    "section.shop"
                ]
                .map(short),
                ["", "/clients", "/invoices", "/books", "/shop"]
                    .map(|s| format!("/{locale}/app{s}")),
                "{locale}: without a shop, the web's short addresses"
            );
        }
    }
}
