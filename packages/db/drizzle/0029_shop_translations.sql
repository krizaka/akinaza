-- The shop page in other languages (#258): the languages the owner turned on, the translations of the page's texts (each with its status,
-- the Orazaka run and the version of the source text it was made from), and a daily counter of translation runs per shop.
CREATE TABLE shop_languages (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  source_locale text NOT NULL DEFAULT 'fr',
  enabled text[] NOT NULL DEFAULT '{fr,en}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_languages_source CHECK (source_locale IN ('fr','en')),
  CONSTRAINT shop_languages_enabled CHECK (enabled <@ ARRAY['fr','en','es'] AND source_locale = ANY (enabled))
);

CREATE TABLE shop_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref_id uuid NOT NULL,
  field text NOT NULL,
  locale text NOT NULL,
  text text NOT NULL,
  status text NOT NULL,
  run_id text,
  source_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_translations_kind CHECK (kind IN ('shop','service')),
  CONSTRAINT shop_translations_locale CHECK (locale IN ('fr','en','es')),
  CONSTRAINT shop_translations_status CHECK (status IN ('auto','edited')),
  CONSTRAINT shop_translations_text CHECK (length(text) BETWEEN 1 AND 2000),
  CONSTRAINT shop_translations_unique UNIQUE (shop_id, kind, ref_id, field, locale)
);

CREATE TABLE shop_translation_runs (
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  day date NOT NULL,
  runs integer NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, day),
  CONSTRAINT shop_translation_runs_positive CHECK (runs >= 0)
);
