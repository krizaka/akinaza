-- The catalogue of prices (@krizaka/settings, akinaza#371): dated versions an administrator schedules, each audited.
CREATE TABLE IF NOT EXISTS app_settings (
  scope      text NOT NULL CHECK (scope IN ('global', 'workspace', 'user')),
  scope_id   text NOT NULL DEFAULT '',
  key        text NOT NULL CHECK (key ~ '^[a-zA-Z0-9.]{1,80}$'),
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (scope, scope_id, key),
  CHECK ((scope = 'global') = (scope_id = ''))
);
CREATE TABLE IF NOT EXISTS settings_audit (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,
  actor_label text NOT NULL,
  scope       text NOT NULL,
  scope_id    text NOT NULL DEFAULT '',
  key         text NOT NULL,
  before      jsonb,
  after       jsonb
);
CREATE INDEX IF NOT EXISTS settings_audit_key ON settings_audit(key, id DESC);

CREATE TABLE IF NOT EXISTS price_versions (
  id             bigserial PRIMARY KEY,
  key            text NOT NULL CHECK (key ~ '^[a-z][a-zA-Z0-9-]{0,39}[.][a-z][a-zA-Z0-9-]{0,39}$'),
  price          jsonb NOT NULL,
  before         jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  created_at     timestamptz NOT NULL,
  actor_id       uuid,
  actor_label    text NOT NULL
);
CREATE INDEX IF NOT EXISTS price_versions_key ON price_versions(key, id);
-- The catalogue's version a subscription was sold at: a founder keeps the founder price, whatever is scheduled later.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_price_version text;
-- The founder offer's cap moved to the Starter entry (`founderCap`): the former setting is retired, never a second source.
-- An override, if one was set, is kept in the audit trail; the administrator re-enters it on the prices page.
INSERT INTO settings_audit (actor_label, scope, scope_id, key, before, after)
  SELECT 'migration 0035', scope, scope_id, key, value, NULL FROM app_settings WHERE key = 'plans.founder.limit';
DELETE FROM app_settings WHERE key = 'plans.founder.limit';
