-- « The workspace, organised » (@krizaka/organize 0.4.0, krizaka-ts ADR-003, akinaza#337): the shop's tags and saved views, for clients and invoices, in the `organize` schema.
-- Generated from `src/workspace.ts` — a test fails when this file and the declaration drift apart. Never edit by hand.

CREATE SCHEMA IF NOT EXISTS organize;
CREATE TABLE organize.kind_config (
  kind       text PRIMARY KEY CHECK (kind ~ '^[a-z][a-z0-9_]{0,39}$'),
  config     jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  version    integer NOT NULL CHECK (version >= 1),
  updated_at timestamptz NOT NULL,
  updated_by uuid REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE TABLE organize.tag (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id   uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  marker     text NOT NULL CHECK (marker IN ('blue', 'green', 'amber', 'red', 'violet', 'gray')),
  origin     text NOT NULL CHECK (origin IN ('preset', 'user')),
  created_at timestamptz NOT NULL,
  UNIQUE (id, kind)
);
CREATE UNIQUE INDEX tag_scope_kind_name ON organize.tag (scope_id, kind, lower(name));
CREATE TABLE organize.view (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id   uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  author_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  filters    jsonb NOT NULL CHECK (jsonb_typeof(filters) = 'object'),
  shared     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX view_author_name ON organize.view (scope_id, kind, author_id, lower(name));
CREATE INDEX view_shared ON organize.view (scope_id, kind) WHERE shared;

CREATE TABLE organize.client_tag (
  entity_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL,
  kind      text NOT NULL DEFAULT 'client' CHECK (kind = 'client'),
  PRIMARY KEY (entity_id, tag_id),
  FOREIGN KEY (tag_id, kind) REFERENCES organize.tag (id, kind) ON DELETE CASCADE
);
CREATE INDEX client_tag_tag ON organize.client_tag (tag_id);
CREATE TABLE organize.client_status (
  entity_id  uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  state      text NOT NULL CHECK (state ~ '^[a-z][a-z0-9_]{0,39}$'),
  changed_at timestamptz NOT NULL,
  changed_by uuid REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE INDEX client_status_state ON organize.client_status (state);

CREATE TABLE organize.invoice_tag (
  entity_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL,
  kind      text NOT NULL DEFAULT 'invoice' CHECK (kind = 'invoice'),
  PRIMARY KEY (entity_id, tag_id),
  FOREIGN KEY (tag_id, kind) REFERENCES organize.tag (id, kind) ON DELETE CASCADE
);
CREATE INDEX invoice_tag_tag ON organize.invoice_tag (tag_id);
CREATE TABLE organize.invoice_status (
  entity_id  uuid PRIMARY KEY REFERENCES invoices(id) ON DELETE CASCADE,
  state      text NOT NULL CHECK (state ~ '^[a-z][a-z0-9_]{0,39}$'),
  changed_at timestamptz NOT NULL,
  changed_by uuid REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE INDEX invoice_status_state ON organize.invoice_status (state);

