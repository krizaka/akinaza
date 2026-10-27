-- Calendar sources (akinaza#282, ADR-004): a connection to a calendar the owner already uses, read-only, and the busy times it gave.
-- The secret (an ICS address, a refresh token) is sealed with the shop's data key; no route ever returns it.
CREATE TABLE calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  secret_enc text NOT NULL,
  consent_text_version text NOT NULL,
  consented_at timestamptz NOT NULL,
  etag text,
  last_modified text,
  state text NOT NULL DEFAULT 'pending',
  failures integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_sync_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_connections_kind CHECK (kind IN ('ics','google','outlook','caldav')),
  CONSTRAINT calendar_connections_state CHECK (state IN ('pending','ok','error')),
  CONSTRAINT calendar_connections_label CHECK (char_length(label) BETWEEN 1 AND 80)
);
CREATE INDEX calendar_connections_shop ON calendar_connections (shop_id);
CREATE INDEX calendar_connections_due ON calendar_connections (next_sync_at);

-- What the owner is busy with elsewhere: a stretch of time, never a title or an attendee. Replaced at each sync, deleted with its connection.
CREATE TABLE busy_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  during tstzrange NOT NULL,
  CONSTRAINT busy_intervals_bounded CHECK (NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during))
);
CREATE INDEX busy_intervals_shop ON busy_intervals (shop_id, staff_id);
CREATE INDEX busy_intervals_connection ON busy_intervals (connection_id);
CREATE INDEX busy_intervals_during ON busy_intervals USING gist (during);
