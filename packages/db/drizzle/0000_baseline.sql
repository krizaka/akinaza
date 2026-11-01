-- ONE baseline (krizaka-internal#2044, founder 2026-10-31: no production yet, no history kept): the schema of the 56 migrations before it,
-- with the Krizaka modules' version markers. The price grid is data from code (src/price-schedule.ts, run by migrate()). A change of schema
-- from now on is a NEW migration after this one (`pnpm --filter @akinaza/db db:generate`); never an edit of a merged one.
SET LOCAL check_function_bodies = false;

CREATE SCHEMA organize;

CREATE SCHEMA privacy;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE FUNCTION privacy.consent_written_once() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'a consent is written once: a withdrawal is a new row' USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE FUNCTION privacy.incident_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.retain_until > now() THEN
      RAISE EXCEPTION 'an incident stays in the register until its retention ends' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'a closed entry of the register is never edited' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id <> OLD.id OR NEW.scope <> OLD.scope THEN
    RAISE EXCEPTION 'an incident never changes register' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.ak_booking_rules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cap integer;
  taken integer;
  visit_shop uuid;
BEGIN
  IF NEW.status <> 'booked' THEN RETURN NEW; END IF;
  SELECT a.shop_id, s.capacity INTO visit_shop, cap
    FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.id = NEW.appointment_id FOR UPDATE OF a;
  IF NOT EXISTS (SELECT 1 FROM clients c JOIN dependants d ON d.client_id = c.id
                  WHERE c.id = NEW.client_id AND d.id = NEW.dependant_id AND c.shop_id = visit_shop AND c.erased_at IS NULL) THEN
    RAISE EXCEPTION 'AK_BOOKING_OWNERSHIP: dependant % is not a dependant of client % of this shop', NEW.dependant_id, NEW.client_id;
  END IF;
  SELECT count(*) INTO taken FROM bookings WHERE appointment_id = NEW.appointment_id AND status = 'booked' AND id <> NEW.id;
  IF taken >= cap THEN
    RAISE EXCEPTION 'AK_CAPACITY_FULL: visit % takes % and has % booked', NEW.appointment_id, cap, taken;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.ak_invoice_balanced() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  lines_sum bigint;
  gst_sum bigint;
  qst_sum bigint;
BEGIN
  SELECT coalesce(sum(amount_cents), 0) INTO lines_sum FROM invoice_lines WHERE invoice_id = NEW.id;
  IF lines_sum <> NEW.subtotal_cents THEN
    RAISE EXCEPTION 'AK_INVOICE_LINES: invoice % has lines of % but a subtotal of %', NEW.number, lines_sum, NEW.subtotal_cents;
  END IF;
  SELECT coalesce(sum(amount_cents) FILTER (WHERE tax = 'gst'), 0), coalesce(sum(amount_cents) FILTER (WHERE tax = 'qst'), 0)
    INTO gst_sum, qst_sum FROM tax_ledger WHERE source_kind = 'invoice' AND source_id = NEW.id;
  IF gst_sum <> NEW.gst_cents OR qst_sum <> NEW.qst_cents THEN
    RAISE EXCEPTION 'AK_LEDGER_UNBALANCED: invoice % charges GST % / QST % but the ledger holds % / %', NEW.number, NEW.gst_cents, NEW.qst_cents, gst_sum, qst_sum;
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION public.ak_ledger_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  src record;
BEGIN
  IF NEW.source_kind = 'invoice' THEN
    SELECT shop_id, issued_on AS on_day INTO src FROM invoices WHERE id = NEW.source_id;
  ELSE
    SELECT shop_id, paid_on AS on_day INTO src FROM expenses WHERE id = NEW.source_id;
  END IF;
  IF src IS NULL OR src.shop_id <> NEW.shop_id OR date_trunc('month', src.on_day)::date <> NEW.period THEN
    RAISE EXCEPTION 'AK_LEDGER_SOURCE: entry for % % does not match its source', NEW.source_kind, NEW.source_id;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.ak_shop_default() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shops WHERE owner_id = NEW.owner_id AND is_default) THEN
    NEW.is_default := true;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.ak_shop_owner_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO memberships (scope_id, account_id, role, invited_by, created_at) VALUES (NEW.id, NEW.owner_id, 'owner', NULL, now()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.ak_shop_slug_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.slug IS NOT NULL AND EXISTS (SELECT 1 FROM shop_former_slugs f WHERE f.slug = NEW.slug AND f.shop_id <> NEW.id) THEN
    RAISE EXCEPTION 'AK_SLUG_TAKEN: % is a former address of another shop', NEW.slug USING ERRCODE = '23505', CONSTRAINT = 'shops_slug';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO shop_former_slugs (slug, shop_id) VALUES (OLD.slug, NEW.id) ON CONFLICT (slug) DO NOTHING;
  END IF;
  IF NEW.slug IS NOT NULL THEN
    DELETE FROM shop_former_slugs WHERE slug = NEW.slug AND shop_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.ak_written_once() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'AK_WRITTEN_ONCE: % rows are never updated or deleted (a correction is a new entry)', TG_TABLE_NAME;
END $$;

CREATE FUNCTION public.collections_create_default(p_owner uuid, p_locale text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE col uuid; base text := CASE p_locale WHEN 'fr' THEN 'Mes commerces' ELSE 'My shops' END; candidate text := base; n int := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM collections WHERE owner_id = p_owner AND name = candidate) LOOP n := n + 1; candidate := base || ' ' || n; END LOOP;
  INSERT INTO collections (owner_id, name, is_default) VALUES (p_owner, candidate, true) RETURNING id INTO col;
  RETURN col;
END $$;

CREATE FUNCTION public.collections_exactly_one_default() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE o uuid := COALESCE(NEW.owner_id, OLD.owner_id);
BEGIN
  IF EXISTS (SELECT 1 FROM accounts WHERE id = o) AND (SELECT count(*) FROM collections WHERE owner_id = o AND is_default) <> 1 THEN RAISE EXCEPTION 'DEFAULT_COLLECTION: an owner has exactly one default collection'; END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION public.collections_guard_default() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.is_default AND EXISTS (SELECT 1 FROM accounts WHERE id = OLD.owner_id) THEN RAISE EXCEPTION 'DEFAULT_COLLECTION: the default collection cannot be deleted'; END IF;
  RETURN OLD;
END $$;

CREATE FUNCTION public.collections_owner_default() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN PERFORM collections_create_default(NEW.id, NEW.locale); RETURN NEW; END $$;

CREATE FUNCTION public.f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $_$;

CREATE FUNCTION public.mark_shop_search_stale(p_shop uuid) RETURNS void
    LANGUAGE sql
    AS $$
  UPDATE shop_search SET avail_stale = true WHERE shop_id = p_shop AND NOT avail_stale $$;

CREATE FUNCTION public.refresh_shop_search(p_shop uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM shop_search WHERE shop_id = p_shop
    AND NOT EXISTS (SELECT 1 FROM shops WHERE id = p_shop AND published AND NOT slug_held AND slug IS NOT NULL);
  INSERT INTO shop_search (shop_id, kind, timezone, slug, name, name_norm, area, tagline_en, tagline_fr, quartiers, lat, lng, search)
  SELECT s.id, s.kind, s.timezone, s.slug, s.name, f_unaccent(lower(s.name)), s.area, s.tagline_en, s.tagline_fr,
         COALESCE(z.names, '{}'), z.lat, z.lng,
         to_tsvector('simple', f_unaccent(concat_ws(' ', s.name, s.area, s.tagline_fr, s.tagline_en, array_to_string(z.names, ' '), v.names)))
  FROM shops s
  LEFT JOIN LATERAL (
    SELECT array_agg(name ORDER BY position, name) AS names,
           (array_agg(lat ORDER BY position, name) FILTER (WHERE NOT (lat IS NULL OR lng IS NULL)))[1] AS lat,
           (array_agg(lng ORDER BY position, name) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL))[1] AS lng
    FROM shop_zones WHERE shop_id = s.id AND active) z ON true
  LEFT JOIN LATERAL (SELECT string_agg(name_fr || ' ' || name_en, ' ') AS names FROM services WHERE shop_id = s.id AND active) v ON true
  WHERE s.id = p_shop AND s.published AND NOT s.slug_held AND s.slug IS NOT NULL
  ON CONFLICT (shop_id) DO UPDATE SET kind = EXCLUDED.kind, timezone = EXCLUDED.timezone, slug = EXCLUDED.slug, name = EXCLUDED.name,
    name_norm = EXCLUDED.name_norm, area = EXCLUDED.area, tagline_en = EXCLUDED.tagline_en, tagline_fr = EXCLUDED.tagline_fr,
    search = EXCLUDED.search, quartiers = EXCLUDED.quartiers, lat = EXCLUDED.lat, lng = EXCLUDED.lng;
END $$;

CREATE FUNCTION public.shop_search_of_child() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN PERFORM refresh_shop_search(COALESCE(NEW.shop_id, OLD.shop_id)); PERFORM mark_shop_search_stale(COALESCE(NEW.shop_id, OLD.shop_id)); RETURN NULL; END $$;

CREATE FUNCTION public.shop_search_of_shop() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN PERFORM refresh_shop_search(NEW.id); PERFORM mark_shop_search_stale(NEW.id); RETURN NULL; END $$;

CREATE FUNCTION public.shop_search_stale_of_booking() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN PERFORM mark_shop_search_stale(a.shop_id) FROM appointments a WHERE a.id = COALESCE(NEW.appointment_id, OLD.appointment_id); RETURN NULL; END $$;

CREATE FUNCTION public.shop_search_stale_of_shop_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN PERFORM mark_shop_search_stale(COALESCE(NEW.shop_id, OLD.shop_id)); RETURN NULL; END $$;

CREATE FUNCTION public.shop_search_stale_of_staff_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN PERFORM mark_shop_search_stale(s.shop_id) FROM staff s WHERE s.id = COALESCE(NEW.staff_id, OLD.staff_id); RETURN NULL; END $$;

CREATE FUNCTION public.shops_default_collection() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.collection_id IS NULL THEN SELECT id INTO NEW.collection_id FROM collections WHERE owner_id = NEW.owner_id AND is_default; END IF;
  RETURN NEW;
END $$;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE organize.client_status (
    entity_id uuid NOT NULL,
    state text NOT NULL,
    changed_at timestamp with time zone NOT NULL,
    changed_by uuid,
    CONSTRAINT client_status_state_check CHECK ((state ~ '^[a-z][a-z0-9_]{0,39}$'::text))
);

CREATE TABLE organize.client_tag (
    entity_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    kind text DEFAULT 'client'::text NOT NULL,
    CONSTRAINT client_tag_kind_check CHECK ((kind = 'client'::text))
);

CREATE TABLE organize.invoice_status (
    entity_id uuid NOT NULL,
    state text NOT NULL,
    changed_at timestamp with time zone NOT NULL,
    changed_by uuid,
    CONSTRAINT invoice_status_state_check CHECK ((state ~ '^[a-z][a-z0-9_]{0,39}$'::text))
);

CREATE TABLE organize.invoice_tag (
    entity_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    kind text DEFAULT 'invoice'::text NOT NULL,
    CONSTRAINT invoice_tag_kind_check CHECK ((kind = 'invoice'::text))
);

CREATE TABLE organize.kind_config (
    kind text NOT NULL,
    config jsonb NOT NULL,
    version integer NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    updated_by uuid,
    CONSTRAINT kind_config_config_check CHECK ((jsonb_typeof(config) = 'object'::text)),
    CONSTRAINT kind_config_kind_check CHECK ((kind ~ '^[a-z][a-z0-9_]{0,39}$'::text)),
    CONSTRAINT kind_config_version_check CHECK ((version >= 1))
);

CREATE TABLE organize.tag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_id uuid NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    marker text NOT NULL,
    origin text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT tag_marker_check CHECK ((marker = ANY (ARRAY['blue'::text, 'green'::text, 'amber'::text, 'red'::text, 'violet'::text, 'gray'::text]))),
    CONSTRAINT tag_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80))),
    CONSTRAINT tag_origin_check CHECK ((origin = ANY (ARRAY['preset'::text, 'user'::text])))
);

CREATE TABLE organize.view (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_id uuid NOT NULL,
    kind text NOT NULL,
    author_id uuid NOT NULL,
    name text NOT NULL,
    filters jsonb NOT NULL,
    shared boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT view_filters_check CHECK ((jsonb_typeof(filters) = 'object'::text)),
    CONSTRAINT view_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)))
);

CREATE TABLE privacy.consent (
    seq bigint NOT NULL,
    id uuid NOT NULL,
    subject_kind text NOT NULL,
    subject_id text NOT NULL,
    purpose text NOT NULL,
    version text NOT NULL,
    granted boolean NOT NULL,
    means text,
    at timestamp with time zone NOT NULL,
    CONSTRAINT consent_means_check CHECK (((means IS NULL) OR (char_length(means) <= 40))),
    CONSTRAINT consent_purpose_check CHECK ((purpose ~ '^[a-z][a-z0-9_-]{0,39}$'::text)),
    CONSTRAINT consent_subject_id_check CHECK (((char_length(subject_id) >= 1) AND (char_length(subject_id) <= 200))),
    CONSTRAINT consent_subject_kind_check CHECK ((subject_kind ~ '^[a-z][a-z0-9_]{0,39}$'::text)),
    CONSTRAINT consent_version_check CHECK (((char_length(version) >= 1) AND (char_length(version) <= 100)))
);

CREATE SEQUENCE privacy.consent_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE privacy.consent_seq_seq OWNED BY privacy.consent.seq;

CREATE TABLE privacy.incident (
    id uuid NOT NULL,
    scope text NOT NULL,
    kind text NOT NULL,
    aware_at timestamp with time zone NOT NULL,
    occurred_at timestamp with time zone,
    description text NOT NULL,
    information text[] NOT NULL,
    persons_concerned integer,
    measures jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text NOT NULL,
    assessment jsonb,
    cai_notice jsonb,
    persons_notice jsonb,
    drill boolean DEFAULT false NOT NULL,
    opened_by text NOT NULL,
    opened_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    retain_until timestamp with time zone NOT NULL,
    CONSTRAINT incident_description_check CHECK (((char_length(description) >= 1) AND (char_length(description) <= 2000))),
    CONSTRAINT incident_information_check CHECK (((cardinality(information) >= 1) AND (cardinality(information) <= 30))),
    CONSTRAINT incident_kind_check CHECK ((kind = ANY (ARRAY['access'::text, 'use'::text, 'communication'::text, 'loss'::text]))),
    CONSTRAINT incident_persons_concerned_check CHECK (((persons_concerned IS NULL) OR (persons_concerned >= 0))),
    CONSTRAINT incident_scope_check CHECK (((char_length(scope) >= 1) AND (char_length(scope) <= 100))),
    CONSTRAINT incident_status_check CHECK ((status = ANY (ARRAY['open'::text, 'assessed'::text, 'closed'::text])))
);

CREATE TABLE privacy.request (
    id uuid NOT NULL,
    subject_kind text NOT NULL,
    subject_id text NOT NULL,
    kind text NOT NULL,
    status text NOT NULL,
    requested_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    failure text,
    CONSTRAINT request_failure_check CHECK (((failure IS NULL) OR (char_length(failure) <= 100))),
    CONSTRAINT request_kind_check CHECK ((kind = ANY (ARRAY['export'::text, 'erasure'::text]))),
    CONSTRAINT request_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT request_subject_id_check CHECK (((char_length(subject_id) >= 1) AND (char_length(subject_id) <= 200))),
    CONSTRAINT request_subject_kind_check CHECK ((subject_kind ~ '^[a-z][a-z0-9_]{0,39}$'::text))
);

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'USER'::text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    locale text DEFAULT 'fr'::text NOT NULL,
    password_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    payment_customer_id text,
    payment_subscription_id text,
    subscription_status text,
    current_period_end timestamp with time zone,
    name text,
    avatar_seed text,
    theme text,
    email_verified_at timestamp with time zone,
    subscription_price_version text,
    CONSTRAINT accounts_avatar_seed_check CHECK (((avatar_seed IS NULL) OR (avatar_seed ~ '^[a-z0-9-]{1,40}$'::text))),
    CONSTRAINT accounts_email_lower CHECK ((email = lower(email))),
    CONSTRAINT accounts_locale CHECK ((locale = ANY (ARRAY['en'::text, 'fr'::text]))),
    CONSTRAINT accounts_name_check CHECK (((name IS NULL) OR (char_length(name) <= 80))),
    CONSTRAINT accounts_role CHECK ((role = ANY (ARRAY['USER'::text, 'ADMIN'::text]))),
    CONSTRAINT accounts_status CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'SUSPENDED'::text]))),
    CONSTRAINT accounts_theme_check CHECK (((theme IS NULL) OR (theme = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text]))))
);

CREATE TABLE public.api_keys (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    public_id text NOT NULL,
    secret_hash text NOT NULL,
    scopes text[] NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    rotated_from_id uuid,
    superseded_at timestamp with time zone,
    CONSTRAINT api_keys_name_check CHECK (((length(name) >= 1) AND (length(name) <= 80))),
    CONSTRAINT api_keys_public_id_check CHECK ((public_id ~ '^[0-9a-f]{12}$'::text)),
    CONSTRAINT api_keys_scopes_check CHECK ((cardinality(scopes) > 0)),
    CONSTRAINT api_keys_secret_hash_check CHECK ((secret_hash ~ '^[0-9a-f]{64}$'::text))
);

CREATE TABLE public.app_settings (
    scope text NOT NULL,
    scope_id text DEFAULT ''::text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT app_settings_check CHECK (((scope = 'global'::text) = (scope_id = ''::text))),
    CONSTRAINT app_settings_key_check CHECK ((key ~ '^[a-zA-Z0-9.]{1,80}$'::text)),
    CONSTRAINT app_settings_scope_check CHECK ((scope = ANY (ARRAY['global'::text, 'workspace'::text, 'user'::text])))
);

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    client_id uuid,
    service_id uuid NOT NULL,
    during tstzrange NOT NULL,
    status text DEFAULT 'booked'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    zone_id uuid,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    CONSTRAINT appointments_bounded CHECK (((NOT isempty(during)) AND (NOT lower_inf(during)) AND (NOT upper_inf(during)))),
    CONSTRAINT appointments_check_order CHECK (((checked_out_at IS NULL) OR ((checked_in_at IS NOT NULL) AND (checked_out_at >= checked_in_at)))),
    CONSTRAINT appointments_status CHECK ((status = ANY (ARRAY['booked'::text, 'done'::text, 'cancelled'::text, 'noShow'::text])))
);

CREATE TABLE public.association_proofs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    kind text NOT NULL,
    reference text NOT NULL,
    note text,
    status text DEFAULT 'pending'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decided_by uuid,
    decision_note text,
    CONSTRAINT association_proofs_decided CHECK (((status = 'pending'::text) = (decided_at IS NULL))),
    CONSTRAINT association_proofs_kind_check CHECK ((kind = ANY (ARRAY['neq'::text, 'charity'::text, 'incorporation'::text]))),
    CONSTRAINT association_proofs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    actor_label text NOT NULL,
    action text NOT NULL,
    target_id text,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip text
);

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;

CREATE TABLE public.booking_codes (
    id text NOT NULL,
    proof text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    payload text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    client_id uuid NOT NULL,
    dependant_id uuid NOT NULL,
    status text DEFAULT 'booked'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    CONSTRAINT bookings_cancelled CHECK (((status = 'cancelled'::text) = (cancelled_at IS NOT NULL))),
    CONSTRAINT bookings_status CHECK ((status = ANY (ARRAY['booked'::text, 'cancelled'::text])))
);

CREATE TABLE public.brief_actions (
    shop_id uuid NOT NULL,
    recommendation_id text NOT NULL,
    kind text NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    done_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brief_actions_kind_check CHECK ((kind = ANY (ARRAY['invite'::text, 'price'::text, 'taxes'::text]))),
    CONSTRAINT brief_actions_recommendation_id_check CHECK ((recommendation_id ~ '^\d{4}-W\d{2}:[a-z]+:[A-Za-z0-9-]+$'::text))
);

CREATE TABLE public.brief_deliveries (
    shop_id uuid NOT NULL,
    week text NOT NULL,
    items integer DEFAULT 0 NOT NULL,
    unsubscribe_sha256 text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brief_deliveries_items_check CHECK (((items >= 0) AND (items <= 3))),
    CONSTRAINT brief_deliveries_unsubscribe_sha256_check CHECK (((unsubscribe_sha256 IS NULL) OR (unsubscribe_sha256 ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT brief_deliveries_week_check CHECK ((week ~ '^\d{4}-W\d{2}$'::text))
);

CREATE TABLE public.busy_intervals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    staff_id uuid,
    during tstzrange NOT NULL,
    CONSTRAINT busy_intervals_bounded CHECK (((NOT isempty(during)) AND (NOT lower_inf(during)) AND (NOT upper_inf(during))))
);

CREATE TABLE public.calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    staff_id uuid,
    kind text NOT NULL,
    label text NOT NULL,
    secret_enc text NOT NULL,
    consent_text_version text NOT NULL,
    consented_at timestamp with time zone NOT NULL,
    etag text,
    last_modified text,
    state text DEFAULT 'pending'::text NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    last_error text,
    last_attempt_at timestamp with time zone,
    last_success_at timestamp with time zone,
    next_sync_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_connections_kind CHECK ((kind = ANY (ARRAY['ics'::text, 'google'::text, 'outlook'::text, 'caldav'::text]))),
    CONSTRAINT calendar_connections_label CHECK (((char_length(label) >= 1) AND (char_length(label) <= 80))),
    CONSTRAINT calendar_connections_state CHECK ((state = ANY (ARRAY['pending'::text, 'ok'::text, 'error'::text])))
);

CREATE TABLE public.client_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    client_id uuid NOT NULL,
    author_account_id uuid,
    author_name text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_notes_body CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 2000)))
);

CREATE TABLE public.client_request_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    url text NOT NULL,
    kind text NOT NULL,
    bytes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_request_files_bytes_check CHECK ((bytes > 0)),
    CONSTRAINT client_request_files_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'pdf'::text])))
);

CREATE TABLE public.client_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    service_id uuid NOT NULL,
    staff_id uuid,
    zone_id uuid,
    title text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_requests_note_check CHECK (((note IS NULL) OR (length(note) <= 500))),
    CONSTRAINT client_requests_title_check CHECK (((length(title) >= 1) AND (length(title) <= 80)))
);

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    notes text,
    language text DEFAULT 'fr'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    erased_at timestamp with time zone,
    account_id uuid,
    access_notes_enc text,
    CONSTRAINT clients_access_notes_sealed CHECK (((access_notes_enc IS NULL) OR (access_notes_enc ~ '^v[0-9]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'::text))),
    CONSTRAINT clients_erased CHECK (((erased_at IS NULL) OR ((email IS NULL) AND (phone IS NULL) AND (notes IS NULL) AND (access_notes_enc IS NULL) AND (account_id IS NULL))))
);

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    avatar jsonb,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collections_avatar_check CHECK (((avatar IS NULL) OR ((jsonb_typeof(avatar) = 'object'::text) AND ((avatar ->> 'kind'::text) = ANY (ARRAY['set'::text, 'image'::text]))))),
    CONSTRAINT collections_description_check CHECK (((description IS NULL) OR (length(description) <= 500))),
    CONSTRAINT collections_name_check CHECK (((length(name) >= 1) AND (length(name) <= 80)))
);

CREATE TABLE public.collections_tags (
    collection_id uuid NOT NULL,
    tag_id uuid NOT NULL
);

CREATE TABLE public.days_off (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    on_date date NOT NULL,
    reason text
);

CREATE TABLE public.dependants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    client_id uuid NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    erased_at timestamp with time zone,
    CONSTRAINT dependants_erased CHECK (((erased_at IS NULL) OR ((name = '—'::text) AND (profile = '{}'::jsonb)))),
    CONSTRAINT dependants_kind CHECK ((kind = ANY (ARRAY['dog'::text, 'cat'::text, 'other'::text])))
);

CREATE TABLE public.email_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    new_email text NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT email_changes_new_email_check CHECK ((new_email = lower(new_email)))
);

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    supplier text NOT NULL,
    paid_on date NOT NULL,
    subtotal_cents integer NOT NULL,
    gst_cents integer NOT NULL,
    qst_cents integer NOT NULL,
    business_share_pct smallint DEFAULT 100 NOT NULL,
    receipt_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenses_amounts CHECK (((subtotal_cents >= 0) AND (gst_cents >= 0) AND (qst_cents >= 0))),
    CONSTRAINT expenses_share CHECK (((business_share_pct >= 0) AND (business_share_pct <= 100)))
);

CREATE TABLE public.feed_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    staff_id uuid,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rotated_at timestamp with time zone,
    revoked_at timestamp with time zone,
    CONSTRAINT feed_tokens_hash_shape CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);

CREATE TABLE public.invitations (
    id uuid NOT NULL,
    scope_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    token_hash text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT invitations_email_check CHECK ((email = lower(email))),
    CONSTRAINT invitations_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])))
);

CREATE TABLE public.invoice_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    view_token_hash text NOT NULL,
    to_email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    opened_at timestamp with time zone,
    revoked_at timestamp with time zone
);

CREATE TABLE public.invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    "position" integer NOT NULL,
    description text NOT NULL,
    quantity_hundredths integer NOT NULL,
    unit_price_cents integer NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    tax_category text NOT NULL,
    amount_cents integer NOT NULL,
    CONSTRAINT invoice_lines_amount CHECK (((amount_cents)::numeric = (round(((((quantity_hundredths)::bigint * (unit_price_cents)::bigint))::numeric / (100)::numeric)) - (discount_cents)::numeric))),
    CONSTRAINT invoice_lines_quantity CHECK ((quantity_hundredths <> 0))
);

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    number text NOT NULL,
    client_id uuid,
    appointment_id uuid,
    credit_of uuid,
    language text DEFAULT 'fr'::text NOT NULL,
    issued_on date NOT NULL,
    subtotal_cents integer NOT NULL,
    gst_cents integer NOT NULL,
    qst_cents integer NOT NULL,
    total_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    terms_days integer,
    due_on date,
    replaces uuid,
    CONSTRAINT invoices_due_set CHECK (((credit_of IS NOT NULL) OR ((terms_days IS NOT NULL) AND (due_on IS NOT NULL)))),
    CONSTRAINT invoices_language CHECK ((language = ANY (ARRAY['fr'::text, 'en'::text]))),
    CONSTRAINT invoices_terms CHECK ((((terms_days IS NULL) AND (due_on IS NULL)) OR ((terms_days IS NOT NULL) AND (due_on IS NOT NULL) AND ((terms_days >= 0) AND (terms_days <= 365)) AND (due_on = (issued_on + terms_days))))),
    CONSTRAINT invoices_total CHECK ((total_cents = ((subtotal_cents + gst_cents) + qst_cents)))
);

CREATE TABLE public.krizaka_module_versions (
    module text NOT NULL,
    version integer NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mail_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    to_email text NOT NULL,
    locale text DEFAULT 'fr'::text NOT NULL,
    template text NOT NULL,
    subject text NOT NULL,
    html text NOT NULL,
    body_text text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    related_kind text,
    related_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    cc_email text,
    from_name text,
    CONSTRAINT mail_outbox_locale CHECK ((locale = ANY (ARRAY['fr'::text, 'en'::text]))),
    CONSTRAINT mail_outbox_status CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])))
);

CREATE TABLE public.memberships (
    scope_id uuid NOT NULL,
    account_id uuid NOT NULL,
    role text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])))
);

CREATE TABLE public.password_resets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);

CREATE TABLE public.payment_events (
    id text NOT NULL,
    type text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    method text NOT NULL,
    amount_cents integer NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_method CHECK ((method = ANY (ARRAY['cash'::text, 'card'::text, 'transfer'::text, 'other'::text])))
);

CREATE TABLE public.price_versions (
    id bigint NOT NULL,
    key text NOT NULL,
    price jsonb NOT NULL,
    before jsonb NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    actor_id uuid,
    actor_label text NOT NULL,
    CONSTRAINT price_versions_key_check CHECK ((key ~ '^[a-z][a-zA-Z0-9-]{0,39}[.][a-z][a-zA-Z0-9-]{0,39}$'::text))
);

CREATE SEQUENCE public.price_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.price_versions_id_seq OWNED BY public.price_versions.id;

CREATE TABLE public.schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    weekday smallint NOT NULL,
    starts_at time without time zone NOT NULL,
    ends_at time without time zone NOT NULL,
    CONSTRAINT schedules_hours CHECK ((ends_at > starts_at)),
    CONSTRAINT schedules_weekday CHECK (((weekday >= 0) AND (weekday <= 6)))
);

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    name_fr text NOT NULL,
    name_en text NOT NULL,
    duration_minutes integer NOT NULL,
    price_cents integer NOT NULL,
    tax_category text DEFAULT 'standard'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    description_fr text,
    description_en text,
    included_fr text[] DEFAULT '{}'::text[] NOT NULL,
    included_en text[] DEFAULT '{}'::text[] NOT NULL,
    price_varies boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    link_url text,
    CONSTRAINT services_capacity CHECK (((capacity >= 1) AND (capacity <= 50))),
    CONSTRAINT services_duration CHECK (((duration_minutes >= 5) AND (duration_minutes <= 600))),
    CONSTRAINT services_link_https CHECK (((link_url IS NULL) OR ((link_url ~~ 'https://%'::text) AND (length(link_url) <= 500)))),
    CONSTRAINT services_price CHECK ((price_cents >= 0)),
    CONSTRAINT services_tax_category CHECK ((tax_category = ANY (ARRAY['standard'::text, 'zeroRated'::text, 'exempt'::text])))
);

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    ip text,
    user_agent text
);

CREATE TABLE public.settings_audit (
    id bigint NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    actor_label text NOT NULL,
    scope text NOT NULL,
    scope_id text DEFAULT ''::text NOT NULL,
    key text NOT NULL,
    before jsonb,
    after jsonb
);

CREATE SEQUENCE public.settings_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.settings_audit_id_seq OWNED BY public.settings_audit.id;

CREATE TABLE public.shop_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    text_fr text DEFAULT ''::text NOT NULL,
    text_en text DEFAULT ''::text NOT NULL,
    photo_url text,
    photo_alt text DEFAULT ''::text NOT NULL,
    ends_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_announcements_photo CHECK (((photo_url IS NULL) OR ((photo_url ~~ 'https://%'::text) AND (length(photo_url) <= 500)))),
    CONSTRAINT shop_announcements_text CHECK (((length(text_fr) <= 500) AND (length(text_en) <= 500) AND ((length(text_fr) + length(text_en)) > 0) AND (length(photo_alt) <= 200)))
);

CREATE TABLE public.shop_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    hostname text NOT NULL,
    state text DEFAULT 'pending-txt'::text NOT NULL,
    token text NOT NULL,
    provider_id text,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    last_checked_at timestamp with time zone,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_domains_hostname_check CHECK ((hostname = lower(hostname))),
    CONSTRAINT shop_domains_state_check CHECK ((state = ANY (ARRAY['pending-txt'::text, 'pending-tls'::text, 'active'::text, 'failed'::text, 'suspended'::text, 'removed'::text])))
);

CREATE TABLE public.shop_figure_rules (
    shop_id uuid NOT NULL,
    overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_figure_rules_object CHECK ((jsonb_typeof(overrides) = 'object'::text))
);

CREATE TABLE public.shop_former_slugs (
    slug text NOT NULL,
    shop_id uuid NOT NULL,
    retired_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_former_slugs_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);

CREATE TABLE public.shop_languages (
    shop_id uuid NOT NULL,
    source_locale text DEFAULT 'fr'::text NOT NULL,
    enabled text[] DEFAULT '{fr,en}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_languages_enabled CHECK (((enabled <@ ARRAY['fr'::text, 'en'::text, 'es'::text]) AND (source_locale = ANY (enabled)))),
    CONSTRAINT shop_languages_source CHECK ((source_locale = ANY (ARRAY['fr'::text, 'en'::text])))
);

CREATE TABLE public.shop_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    role text NOT NULL,
    url text NOT NULL,
    webm_url text,
    mp4_url text,
    alt_fr text DEFAULT ''::text NOT NULL,
    alt_en text DEFAULT ''::text NOT NULL,
    caption_fr text,
    caption_en text,
    wide boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT shop_media_role CHECK ((role = ANY (ARRAY['cover'::text, 'gallery'::text]))),
    CONSTRAINT shop_media_urls CHECK (((url ~ '^https://'::text) AND (COALESCE(webm_url, 'https://'::text) ~ '^https://'::text) AND (COALESCE(mp4_url, 'https://'::text) ~ '^https://'::text)))
);

CREATE TABLE public.shop_page (
    shop_id uuid NOT NULL,
    sections jsonb DEFAULT '[{"id": "services", "visible": true}, {"id": "team", "visible": true}, {"id": "hours", "visible": true}, {"id": "zones", "visible": true}, {"id": "gallery", "visible": true}, {"id": "wall", "visible": true}, {"id": "reels", "visible": true}, {"id": "announcements", "visible": true}, {"id": "reviews", "visible": true}, {"id": "follow", "visible": true}]'::jsonb NOT NULL,
    logo_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shop_type text,
    use_defaults boolean DEFAULT true NOT NULL,
    template_id text,
    template_version integer,
    sections_custom boolean DEFAULT false NOT NULL,
    style jsonb DEFAULT '{}'::jsonb NOT NULL,
    accent text,
    paper text,
    logo_dark_url text,
    CONSTRAINT shop_page_accent CHECK (((accent IS NULL) OR (accent ~ '^[a-z0-9:-]{1,40}$'::text))),
    CONSTRAINT shop_page_logo_dark_https CHECK (((logo_dark_url IS NULL) OR ((logo_dark_url ~~ 'https://%'::text) AND (length(logo_dark_url) <= 500)))),
    CONSTRAINT shop_page_logo_https CHECK (((logo_url IS NULL) OR ((logo_url ~~ 'https://%'::text) AND (length(logo_url) <= 500)))),
    CONSTRAINT shop_page_paper CHECK (((paper IS NULL) OR (paper = ANY (ARRAY['plain'::text, 'seyes'::text, 'kraft'::text, 'washi'::text])))),
    CONSTRAINT shop_page_shop_type CHECK (((shop_type IS NULL) OR (shop_type = ANY (ARRAY['salon'::text, 'coaching'::text, 'workshop'::text, 'cleaning'::text, 'pets'::text, 'consulting'::text])))),
    CONSTRAINT shop_page_template_id CHECK (((template_id IS NULL) OR (template_id ~ '^[a-z]+-[a-z]+$'::text))),
    CONSTRAINT shop_page_template_pair CHECK ((((template_id IS NULL) = (template_version IS NULL)) AND ((template_version IS NULL) OR (template_version >= 1))))
);

CREATE TABLE public.shop_page_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    version integer NOT NULL,
    status text NOT NULL,
    schema integer NOT NULL,
    doc jsonb NOT NULL,
    author_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT shop_page_versions_doc_check CHECK ((jsonb_typeof(doc) = 'object'::text)),
    CONSTRAINT shop_page_versions_published CHECK (((status = 'draft'::text) = (published_at IS NULL))),
    CONSTRAINT shop_page_versions_schema_check CHECK ((schema >= 1)),
    CONSTRAINT shop_page_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT shop_page_versions_version_check CHECK ((version >= 1))
);

CREATE TABLE public.shop_reels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    kind text NOT NULL,
    mp4_url text,
    webm_url text,
    poster_url text,
    seconds double precision,
    platform text,
    external_url text,
    embed_url text,
    title_fr text DEFAULT ''::text NOT NULL,
    title_en text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    "position" integer NOT NULL,
    CONSTRAINT shop_reels_kind CHECK ((((kind = 'upload'::text) AND ((mp4_url IS NOT NULL) OR (webm_url IS NOT NULL)) AND (platform IS NULL)) OR ((kind = 'external'::text) AND (platform IS NOT NULL) AND (external_url IS NOT NULL) AND (embed_url IS NOT NULL)))),
    CONSTRAINT shop_reels_platform CHECK (((platform IS NULL) OR (platform = ANY (ARRAY['tiktok'::text, 'youtube-shorts'::text, 'instagram'::text])))),
    CONSTRAINT shop_reels_position CHECK ((("position" >= 0) AND ("position" < 100))),
    CONSTRAINT shop_reels_titles CHECK (((length(title_fr) <= 60) AND (length(title_en) <= 60))),
    CONSTRAINT shop_reels_urls CHECK (((COALESCE(mp4_url, 'https://'::text) ~ '^https://'::text) AND (COALESCE(webm_url, 'https://'::text) ~ '^https://'::text) AND (COALESCE(poster_url, 'https://'::text) ~ '^https://'::text) AND (COALESCE(external_url, 'https://'::text) ~ '^https://'::text) AND (COALESCE(embed_url, 'https://'::text) ~ '^https://'::text)))
);

CREATE TABLE public.shop_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    client_id uuid,
    first_name text NOT NULL,
    last_initial text DEFAULT ''::text NOT NULL,
    rating smallint NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    service_name text DEFAULT ''::text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    state text DEFAULT 'published'::text NOT NULL,
    reply text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_reviews_rating CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT shop_reviews_state CHECK ((state = ANY (ARRAY['published'::text, 'hidden_by_owner'::text, 'removed_by_admin'::text, 'pending'::text]))),
    CONSTRAINT shop_reviews_texts CHECK (((length(body) <= 1000) AND (length(reply) <= 1000) AND (length(first_name) <= 40) AND (length(last_initial) <= 2) AND (length(service_name) <= 120)))
);

CREATE TABLE public.shop_rules (
    shop_id uuid NOT NULL,
    cancellation_hours integer DEFAULT 24 NOT NULL,
    booking_horizon_days integer DEFAULT 60 NOT NULL,
    slot_step_minutes integer DEFAULT 30 NOT NULL,
    min_notice_minutes integer DEFAULT 120 NOT NULL,
    report_link_days integer DEFAULT 30 NOT NULL,
    CONSTRAINT shop_rules_cancellation CHECK (((cancellation_hours >= 0) AND (cancellation_hours <= 168))),
    CONSTRAINT shop_rules_horizon CHECK (((booking_horizon_days >= 1) AND (booking_horizon_days <= 180))),
    CONSTRAINT shop_rules_link CHECK (((report_link_days >= 1) AND (report_link_days <= 365))),
    CONSTRAINT shop_rules_notice CHECK (((min_notice_minutes >= 0) AND (min_notice_minutes <= 10080))),
    CONSTRAINT shop_rules_step CHECK (((slot_step_minutes >= 5) AND (slot_step_minutes <= 240)))
);

CREATE TABLE public.shop_search (
    shop_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    name_norm text NOT NULL,
    kind text NOT NULL,
    area text,
    tagline_fr text,
    tagline_en text,
    timezone text NOT NULL,
    quartiers text[] DEFAULT '{}'::text[] NOT NULL,
    lat double precision,
    lng double precision,
    pt point GENERATED ALWAYS AS (
CASE
    WHEN ((lat IS NOT NULL) AND (lng IS NOT NULL)) THEN point(lng, lat)
    ELSE NULL::point
END) STORED,
    search tsvector NOT NULL,
    next_free_at timestamp with time zone,
    open_week boolean DEFAULT false NOT NULL,
    avail_day date,
    avail_at timestamp with time zone,
    avail_stale boolean DEFAULT true NOT NULL
);

CREATE TABLE public.shop_slug_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.shop_social_links (
    shop_id uuid NOT NULL,
    platform text NOT NULL,
    url text NOT NULL,
    CONSTRAINT shop_social_links_platform CHECK ((platform = ANY (ARRAY['tiktok'::text, 'youtube'::text, 'instagram'::text, 'facebook'::text]))),
    CONSTRAINT shop_social_links_url CHECK (((url ~~ 'https://%'::text) AND (length(url) <= 300)))
);

CREATE TABLE public.shop_tags (
    shop_id uuid NOT NULL,
    tag_id uuid NOT NULL
);

CREATE TABLE public.shop_translation_runs (
    shop_id uuid NOT NULL,
    day date NOT NULL,
    runs integer DEFAULT 0 NOT NULL,
    CONSTRAINT shop_translation_runs_positive CHECK ((runs >= 0))
);

CREATE TABLE public.shop_translations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    kind text NOT NULL,
    ref_id uuid NOT NULL,
    field text NOT NULL,
    locale text NOT NULL,
    text text NOT NULL,
    status text NOT NULL,
    run_id text,
    source_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_translations_kind CHECK ((kind = ANY (ARRAY['shop'::text, 'service'::text]))),
    CONSTRAINT shop_translations_locale CHECK ((locale = ANY (ARRAY['fr'::text, 'en'::text, 'es'::text]))),
    CONSTRAINT shop_translations_status CHECK ((status = ANY (ARRAY['auto'::text, 'edited'::text]))),
    CONSTRAINT shop_translations_text CHECK (((length(text) >= 1) AND (length(text) <= 2000)))
);

CREATE TABLE public.shop_wall (
    shop_id uuid NOT NULL,
    texture text DEFAULT 'plaster'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shop_wall_texture CHECK ((texture = ANY (ARRAY['brick'::text, 'zellige'::text, 'ridge'::text, 'plaster'::text])))
);

CREATE TABLE public.shop_wall_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    kind text NOT NULL,
    x double precision NOT NULL,
    y double precision NOT NULL,
    rotation double precision DEFAULT 0 NOT NULL,
    z integer DEFAULT 0 NOT NULL,
    attachment text DEFAULT 'tape'::text NOT NULL,
    variant text,
    image_url text,
    alt_fr text DEFAULT ''::text NOT NULL,
    alt_en text DEFAULT ''::text NOT NULL,
    caption_fr text DEFAULT ''::text NOT NULL,
    caption_en text DEFAULT ''::text NOT NULL,
    text_fr text DEFAULT ''::text NOT NULL,
    text_en text DEFAULT ''::text NOT NULL,
    signature text DEFAULT ''::text NOT NULL,
    CONSTRAINT shop_wall_items_attachment CHECK ((attachment = ANY (ARRAY['tape'::text, 'pin'::text]))),
    CONSTRAINT shop_wall_items_image CHECK (((image_url IS NULL) OR ((image_url ~~ 'https://%'::text) AND (length(image_url) <= 500)))),
    CONSTRAINT shop_wall_items_kind CHECK ((kind = ANY (ARRAY['polaroid'::text, 'note'::text, 'sign'::text]))),
    CONSTRAINT shop_wall_items_place CHECK ((((x >= (0)::double precision) AND (x <= (100)::double precision)) AND ((y >= (0)::double precision) AND (y <= (100)::double precision)) AND ((rotation >= ('-8'::integer)::double precision) AND (rotation <= (8)::double precision)) AND ((z >= 0) AND (z <= 1000)))),
    CONSTRAINT shop_wall_items_texts CHECK (((length(caption_fr) <= 40) AND (length(caption_en) <= 40) AND (length(text_fr) <= 140) AND (length(text_en) <= 140) AND (length(signature) <= 40) AND (length(alt_fr) <= 200) AND (length(alt_en) <= 200))),
    CONSTRAINT shop_wall_items_variant CHECK (((variant IS NULL) OR (variant = ANY (ARRAY['enamel'::text, 'neon'::text, 'painted'::text]))))
);

CREATE TABLE public.shop_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    lat double precision,
    lng double precision,
    CONSTRAINT shop_zones_name CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 80))),
    CONSTRAINT shop_zones_position CHECK ((((lat IS NULL) = (lng IS NULL)) AND ((lat IS NULL) OR (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)) AND ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision))))))
);

CREATE TABLE public.shops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    name text NOT NULL,
    legal_name text NOT NULL,
    kind text NOT NULL,
    registrant boolean DEFAULT true NOT NULL,
    gst_number text,
    qst_number text,
    address text NOT NULL,
    timezone text DEFAULT 'America/Toronto'::text NOT NULL,
    invoice_prefix text DEFAULT 'F'::text NOT NULL,
    next_invoice_number integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    published boolean DEFAULT false NOT NULL,
    tagline_fr text,
    tagline_en text,
    area text,
    bio_fr text,
    bio_en text,
    public_phone text,
    public_email text,
    seat_unit_fr text,
    seat_unit_en text,
    public_website text,
    business_type text DEFAULT 'professional'::text NOT NULL,
    payment_terms_days integer DEFAULT 30 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    description text,
    avatar jsonb,
    collection_id uuid,
    brief_email boolean DEFAULT true NOT NULL,
    invoice_mail_message text DEFAULT ''::text NOT NULL,
    invoice_mail_from_name text,
    invoice_mail_copy boolean DEFAULT false NOT NULL,
    invoice_link_days integer DEFAULT 30 NOT NULL,
    organized_at timestamp with time zone,
    slug_held boolean DEFAULT false NOT NULL,
    slug_held_term text,
    slug_held_at timestamp with time zone,
    slug_hold_note text,
    slug_hold_reviewed_at timestamp with time zone,
    slug_cleared_for text,
    reel_transition text DEFAULT 'channel'::text NOT NULL,
    custom_domain_enabled boolean DEFAULT false NOT NULL,
    custom_domain_price_version text,
    custom_domain_enabled_at timestamp with time zone,
    CONSTRAINT shops_business_type CHECK ((business_type = ANY (ARRAY['professional'::text, 'pets'::text]))),
    CONSTRAINT shops_held_has_slug CHECK (((NOT slug_held) OR (slug IS NOT NULL))),
    CONSTRAINT shops_invoice_link_days CHECK (((invoice_link_days >= 1) AND (invoice_link_days <= 365))),
    CONSTRAINT shops_invoice_mail_from_name CHECK (((invoice_mail_from_name IS NULL) OR ((length(invoice_mail_from_name) >= 1) AND (length(invoice_mail_from_name) <= 120)))),
    CONSTRAINT shops_invoice_mail_message CHECK ((length(invoice_mail_message) <= 500)),
    CONSTRAINT shops_kind CHECK ((kind = ANY (ARRAY['salon'::text, 'boutique'::text, 'services'::text, 'other'::text]))),
    CONSTRAINT shops_payment_terms CHECK (((payment_terms_days >= 0) AND (payment_terms_days <= 365))),
    CONSTRAINT shops_public_text CHECK (((length(COALESCE(area, ''::text)) <= 80) AND (length(COALESCE(bio_fr, ''::text)) <= 600) AND (length(COALESCE(bio_en, ''::text)) <= 600) AND (length(COALESCE(public_phone, ''::text)) <= 40) AND (length(COALESCE(public_email, ''::text)) <= 120) AND (length(COALESCE(seat_unit_fr, ''::text)) <= 30) AND (length(COALESCE(seat_unit_en, ''::text)) <= 30))),
    CONSTRAINT shops_public_website CHECK ((length(COALESCE(public_website, ''::text)) <= 200)),
    CONSTRAINT shops_published_has_slug CHECK (((NOT published) OR (slug IS NOT NULL))),
    CONSTRAINT shops_reel_transition CHECK ((reel_transition = ANY (ARRAY['channel'::text, 'crossfade'::text, 'slide'::text]))),
    CONSTRAINT shops_slug_format CHECK (((slug IS NULL) OR ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((length(slug) >= 3) AND (length(slug) <= 40))))),
    CONSTRAINT shops_tax_numbers CHECK (((NOT registrant) OR ((COALESCE(gst_number, ''::text) ~ '^[0-9]{9}RT[0-9]{4}$'::text) AND (COALESCE(qst_number, ''::text) ~ '^[0-9]{10}TQ[0-9]{4}$'::text))))
);

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    account_id uuid
);

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    CONSTRAINT tags_color_check CHECK ((color = ANY (ARRAY['blue'::text, 'green'::text, 'amber'::text, 'red'::text, 'violet'::text, 'gray'::text])))
);

CREATE TABLE public.tax_ledger (
    id bigint NOT NULL,
    shop_id uuid NOT NULL,
    period date NOT NULL,
    tax text NOT NULL,
    direction text NOT NULL,
    amount_cents integer NOT NULL,
    source_kind text NOT NULL,
    source_id uuid NOT NULL,
    source_label text NOT NULL,
    posted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tax_ledger_direction CHECK ((direction = ANY (ARRAY['collected'::text, 'credit'::text]))),
    CONSTRAINT tax_ledger_period_month CHECK ((EXTRACT(day FROM period) = (1)::numeric)),
    CONSTRAINT tax_ledger_source_direction CHECK ((((source_kind = 'invoice'::text) AND (direction = 'collected'::text)) OR ((source_kind = 'expense'::text) AND (direction = 'credit'::text)))),
    CONSTRAINT tax_ledger_tax CHECK ((tax = ANY (ARRAY['gst'::text, 'qst'::text])))
);

CREATE SEQUENCE public.tax_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.tax_ledger_id_seq OWNED BY public.tax_ledger.id;

CREATE TABLE public.visit_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    note text NOT NULL,
    photo bytea,
    photo_type text,
    duration_minutes integer NOT NULL,
    view_token_hash text NOT NULL,
    token_expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT visit_reports_duration CHECK (((duration_minutes >= 1) AND (duration_minutes <= 1440))),
    CONSTRAINT visit_reports_note CHECK (((length(note) >= 1) AND (length(note) <= 1000))),
    CONSTRAINT visit_reports_photo_size CHECK (((photo IS NULL) OR (octet_length(photo) <= 1572864))),
    CONSTRAINT visit_reports_photo_type CHECK ((((photo IS NULL) = (photo_type IS NULL)) AND ((photo_type IS NULL) OR (photo_type = ANY (ARRAY['jpeg'::text, 'png'::text, 'webp'::text])))))
);

CREATE TABLE public.webhook_deliveries (
    id uuid NOT NULL,
    endpoint_id uuid NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone NOT NULL,
    last_status integer,
    last_error text,
    created_at timestamp with time zone NOT NULL,
    delivered_at timestamp with time zone,
    CONSTRAINT webhook_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text])))
);

CREATE TABLE public.webhook_endpoints (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    url text NOT NULL,
    secret_sealed text NOT NULL,
    events text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    disabled_why text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT webhook_endpoints_events_check CHECK ((cardinality(events) > 0)),
    CONSTRAINT webhook_endpoints_url_check CHECK ((char_length(url) <= 500))
);

CREATE TABLE public.webhook_received (
    source text NOT NULL,
    event_id text NOT NULL,
    received_at timestamp with time zone NOT NULL
);

ALTER TABLE ONLY privacy.consent ALTER COLUMN seq SET DEFAULT nextval('privacy.consent_seq_seq'::regclass);

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);

ALTER TABLE ONLY public.price_versions ALTER COLUMN id SET DEFAULT nextval('public.price_versions_id_seq'::regclass);

ALTER TABLE ONLY public.settings_audit ALTER COLUMN id SET DEFAULT nextval('public.settings_audit_id_seq'::regclass);

ALTER TABLE ONLY public.tax_ledger ALTER COLUMN id SET DEFAULT nextval('public.tax_ledger_id_seq'::regclass);

ALTER TABLE ONLY organize.client_status
    ADD CONSTRAINT client_status_pkey PRIMARY KEY (entity_id);

ALTER TABLE ONLY organize.client_tag
    ADD CONSTRAINT client_tag_pkey PRIMARY KEY (entity_id, tag_id);

ALTER TABLE ONLY organize.invoice_status
    ADD CONSTRAINT invoice_status_pkey PRIMARY KEY (entity_id);

ALTER TABLE ONLY organize.invoice_tag
    ADD CONSTRAINT invoice_tag_pkey PRIMARY KEY (entity_id, tag_id);

ALTER TABLE ONLY organize.kind_config
    ADD CONSTRAINT kind_config_pkey PRIMARY KEY (kind);

ALTER TABLE ONLY organize.tag
    ADD CONSTRAINT tag_id_kind_key UNIQUE (id, kind);

ALTER TABLE ONLY organize.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);

ALTER TABLE ONLY organize.view
    ADD CONSTRAINT view_pkey PRIMARY KEY (id);

ALTER TABLE ONLY privacy.consent
    ADD CONSTRAINT consent_pkey PRIMARY KEY (id);

ALTER TABLE ONLY privacy.consent
    ADD CONSTRAINT consent_seq_key UNIQUE (seq);

ALTER TABLE ONLY privacy.incident
    ADD CONSTRAINT incident_pkey PRIMARY KEY (id);

ALTER TABLE ONLY privacy.request
    ADD CONSTRAINT request_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_email_unique UNIQUE (email);

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_public_id_key UNIQUE (public_id);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (scope, scope_id, key);

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_no_double_booking EXCLUDE USING gist (staff_id WITH =, during WITH &&) WHERE ((status <> 'cancelled'::text));

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.association_proofs
    ADD CONSTRAINT association_proofs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.booking_codes
    ADD CONSTRAINT booking_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.brief_actions
    ADD CONSTRAINT brief_actions_pkey PRIMARY KEY (shop_id, recommendation_id);

ALTER TABLE ONLY public.brief_deliveries
    ADD CONSTRAINT brief_deliveries_pkey PRIMARY KEY (shop_id, week);

ALTER TABLE ONLY public.busy_intervals
    ADD CONSTRAINT busy_intervals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_notes
    ADD CONSTRAINT client_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_request_files
    ADD CONSTRAINT client_request_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_one_default EXCLUDE USING btree (owner_id WITH =) WHERE (is_default) DEFERRABLE;

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_owner_id_name_key UNIQUE (owner_id, name);

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.collections_tags
    ADD CONSTRAINT collections_tags_pkey PRIMARY KEY (collection_id, tag_id);

ALTER TABLE ONLY public.days_off
    ADD CONSTRAINT days_off_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dependants
    ADD CONSTRAINT dependants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_changes
    ADD CONSTRAINT email_changes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_changes
    ADD CONSTRAINT email_changes_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feed_tokens
    ADD CONSTRAINT feed_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.invoice_deliveries
    ADD CONSTRAINT invoice_deliveries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoice_deliveries
    ADD CONSTRAINT invoice_deliveries_view_token_hash_key UNIQUE (view_token_hash);

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.krizaka_module_versions
    ADD CONSTRAINT krizaka_module_versions_pkey PRIMARY KEY (module, version);

ALTER TABLE ONLY public.mail_outbox
    ADD CONSTRAINT mail_outbox_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (scope_id, account_id);

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.price_versions
    ADD CONSTRAINT price_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash);

ALTER TABLE ONLY public.settings_audit
    ADD CONSTRAINT settings_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_announcements
    ADD CONSTRAINT shop_announcements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_domains
    ADD CONSTRAINT shop_domains_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_figure_rules
    ADD CONSTRAINT shop_figure_rules_pkey PRIMARY KEY (shop_id);

ALTER TABLE ONLY public.shop_former_slugs
    ADD CONSTRAINT shop_former_slugs_pkey PRIMARY KEY (slug);

ALTER TABLE ONLY public.shop_languages
    ADD CONSTRAINT shop_languages_pkey PRIMARY KEY (shop_id);

ALTER TABLE ONLY public.shop_media
    ADD CONSTRAINT shop_media_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_page
    ADD CONSTRAINT shop_page_pkey PRIMARY KEY (shop_id);

ALTER TABLE ONLY public.shop_page_versions
    ADD CONSTRAINT shop_page_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_page_versions
    ADD CONSTRAINT shop_page_versions_shop_id_version_key UNIQUE (shop_id, version);

ALTER TABLE ONLY public.shop_reels
    ADD CONSTRAINT shop_reels_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_reviews
    ADD CONSTRAINT shop_reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_rules
    ADD CONSTRAINT shop_rules_pkey PRIMARY KEY (shop_id);

ALTER TABLE ONLY public.shop_search
    ADD CONSTRAINT shop_search_pkey PRIMARY KEY (shop_id);

ALTER TABLE ONLY public.shop_slug_changes
    ADD CONSTRAINT shop_slug_changes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_social_links
    ADD CONSTRAINT shop_social_links_pkey PRIMARY KEY (shop_id, platform);

ALTER TABLE ONLY public.shop_tags
    ADD CONSTRAINT shop_tags_pkey PRIMARY KEY (shop_id, tag_id);

ALTER TABLE ONLY public.shop_translation_runs
    ADD CONSTRAINT shop_translation_runs_pkey PRIMARY KEY (shop_id, day);

ALTER TABLE ONLY public.shop_translations
    ADD CONSTRAINT shop_translations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_translations
    ADD CONSTRAINT shop_translations_unique UNIQUE (shop_id, kind, ref_id, field, locale);

ALTER TABLE ONLY public.shop_wall_items
    ADD CONSTRAINT shop_wall_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shop_wall
    ADD CONSTRAINT shop_wall_pkey PRIMARY KEY (shop_id);

ALTER TABLE ONLY public.shop_zones
    ADD CONSTRAINT shop_zones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_one_default_per_owner EXCLUDE USING btree (owner_id WITH =) WHERE (is_default) DEFERRABLE;

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tax_ledger
    ADD CONSTRAINT tax_ledger_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_booking_id_key UNIQUE (booking_id);

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_view_token_hash_key UNIQUE (view_token_hash);

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_endpoint_id_event_id_key UNIQUE (endpoint_id, event_id);

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_received
    ADD CONSTRAINT webhook_received_pkey PRIMARY KEY (source, event_id);

CREATE INDEX client_status_state ON organize.client_status USING btree (state);

CREATE INDEX client_tag_tag ON organize.client_tag USING btree (tag_id);

CREATE INDEX invoice_status_state ON organize.invoice_status USING btree (state);

CREATE INDEX invoice_tag_tag ON organize.invoice_tag USING btree (tag_id);

CREATE UNIQUE INDEX tag_scope_kind_name ON organize.tag USING btree (scope_id, kind, lower(name));

CREATE UNIQUE INDEX view_author_name ON organize.view USING btree (scope_id, kind, author_id, lower(name));

CREATE INDEX view_shared ON organize.view USING btree (scope_id, kind) WHERE shared;

CREATE INDEX consent_subject ON privacy.consent USING btree (subject_kind, subject_id, purpose, seq DESC);

CREATE INDEX incident_scope ON privacy.incident USING btree (scope, aware_at, id);

CREATE INDEX request_subject ON privacy.request USING btree (subject_kind, subject_id, requested_at DESC);

CREATE UNIQUE INDEX accounts_payment_customer ON public.accounts USING btree (payment_customer_id) WHERE (payment_customer_id IS NOT NULL);

CREATE INDEX api_keys_owner ON public.api_keys USING btree (owner_id, created_at);

CREATE INDEX appointments_shop ON public.appointments USING btree (shop_id);

CREATE INDEX association_proofs_account ON public.association_proofs USING btree (account_id, submitted_at);

CREATE UNIQUE INDEX association_proofs_one_pending ON public.association_proofs USING btree (account_id) WHERE (status = 'pending'::text);

CREATE INDEX audit_log_at ON public.audit_log USING btree (at);

CREATE INDEX booking_codes_expires ON public.booking_codes USING btree (expires_at);

CREATE INDEX bookings_client ON public.bookings USING btree (client_id);

CREATE UNIQUE INDEX bookings_one_seat ON public.bookings USING btree (appointment_id, dependant_id) WHERE (status = 'booked'::text);

CREATE INDEX brief_deliveries_unsubscribe ON public.brief_deliveries USING btree (unsubscribe_sha256) WHERE (unsubscribe_sha256 IS NOT NULL);

CREATE INDEX busy_intervals_connection ON public.busy_intervals USING btree (connection_id);

CREATE INDEX busy_intervals_during ON public.busy_intervals USING gist (during);

CREATE INDEX busy_intervals_shop ON public.busy_intervals USING btree (shop_id, staff_id);

CREATE INDEX calendar_connections_due ON public.calendar_connections USING btree (next_sync_at);

CREATE INDEX calendar_connections_shop ON public.calendar_connections USING btree (shop_id);

CREATE INDEX client_notes_shop_client ON public.client_notes USING btree (shop_id, client_id, created_at);

CREATE INDEX client_request_files_request ON public.client_request_files USING btree (request_id);

CREATE INDEX client_requests_client ON public.client_requests USING btree (client_id);

CREATE UNIQUE INDEX clients_account_per_shop ON public.clients USING btree (shop_id, account_id) WHERE (account_id IS NOT NULL);

CREATE INDEX clients_shop ON public.clients USING btree (shop_id);

CREATE UNIQUE INDEX days_off_staff_day ON public.days_off USING btree (staff_id, on_date);

CREATE INDEX dependants_client ON public.dependants USING btree (client_id);

CREATE INDEX dependants_shop ON public.dependants USING btree (shop_id);

CREATE INDEX expenses_shop ON public.expenses USING btree (shop_id, paid_on);

CREATE UNIQUE INDEX feed_tokens_active_shop ON public.feed_tokens USING btree (shop_id) WHERE ((staff_id IS NULL) AND (revoked_at IS NULL));

CREATE UNIQUE INDEX feed_tokens_active_staff ON public.feed_tokens USING btree (shop_id, staff_id) WHERE ((staff_id IS NOT NULL) AND (revoked_at IS NULL));

CREATE UNIQUE INDEX feed_tokens_hash ON public.feed_tokens USING btree (token_hash);

CREATE INDEX feed_tokens_shop ON public.feed_tokens USING btree (shop_id);

CREATE INDEX invitations_scope ON public.invitations USING btree (scope_id) WHERE (used_at IS NULL);

CREATE INDEX invoice_deliveries_invoice ON public.invoice_deliveries USING btree (invoice_id, created_at);

CREATE UNIQUE INDEX invoice_lines_position ON public.invoice_lines USING btree (invoice_id, "position");

CREATE UNIQUE INDEX invoices_number ON public.invoices USING btree (shop_id, number);

CREATE UNIQUE INDEX invoices_replaced_once ON public.invoices USING btree (replaces) WHERE (replaces IS NOT NULL);

CREATE INDEX mail_outbox_pending ON public.mail_outbox USING btree (created_at) WHERE (status = 'pending'::text);

CREATE INDEX mail_outbox_related ON public.mail_outbox USING btree (related_kind, related_id);

CREATE INDEX memberships_account ON public.memberships USING btree (account_id);

CREATE INDEX password_resets_account ON public.password_resets USING btree (account_id);

CREATE INDEX price_versions_key ON public.price_versions USING btree (key, id);

CREATE INDEX schedules_staff_weekday ON public.schedules USING btree (staff_id, weekday);

CREATE INDEX services_shop ON public.services USING btree (shop_id);

CREATE INDEX sessions_account ON public.sessions USING btree (account_id);

CREATE INDEX settings_audit_key ON public.settings_audit USING btree (key, id DESC);

CREATE INDEX shop_announcements_shop ON public.shop_announcements USING btree (shop_id, created_at);

CREATE UNIQUE INDEX shop_domains_claim ON public.shop_domains USING btree (hostname) WHERE (state = ANY (ARRAY['pending-tls'::text, 'active'::text]));

CREATE INDEX shop_domains_due ON public.shop_domains USING btree (last_checked_at NULLS FIRST) WHERE (state = ANY (ARRAY['pending-txt'::text, 'pending-tls'::text, 'active'::text]));

CREATE INDEX shop_domains_shop ON public.shop_domains USING btree (shop_id) WHERE (state <> 'removed'::text);

CREATE INDEX shop_former_slugs_shop ON public.shop_former_slugs USING btree (shop_id);

CREATE UNIQUE INDEX shop_media_one_cover ON public.shop_media USING btree (shop_id) WHERE (role = 'cover'::text);

CREATE INDEX shop_media_shop ON public.shop_media USING btree (shop_id, role, "position");

CREATE UNIQUE INDEX shop_page_versions_one_draft ON public.shop_page_versions USING btree (shop_id) WHERE (status = 'draft'::text);

CREATE UNIQUE INDEX shop_page_versions_one_published ON public.shop_page_versions USING btree (shop_id) WHERE (status = 'published'::text);

CREATE INDEX shop_reels_shop ON public.shop_reels USING btree (shop_id, created_at);

CREATE UNIQUE INDEX shop_reviews_one_per_client ON public.shop_reviews USING btree (shop_id, client_id) WHERE (client_id IS NOT NULL);

CREATE INDEX shop_reviews_shop ON public.shop_reviews USING btree (shop_id, created_at);

CREATE INDEX shop_search_due ON public.shop_search USING btree (avail_stale) WHERE avail_stale;

CREATE INDEX shop_search_fts ON public.shop_search USING gin (search);

CREATE INDEX shop_search_kind ON public.shop_search USING btree (kind);

CREATE INDEX shop_search_name_trgm ON public.shop_search USING gin (name_norm public.gin_trgm_ops);

CREATE INDEX shop_search_order ON public.shop_search USING btree (name, shop_id);

CREATE INDEX shop_search_pt ON public.shop_search USING gist (pt);

CREATE INDEX shop_slug_changes_shop_at ON public.shop_slug_changes USING btree (shop_id, at);

CREATE INDEX shop_wall_items_shop ON public.shop_wall_items USING btree (shop_id, z);

CREATE UNIQUE INDEX shop_zones_name_per_shop ON public.shop_zones USING btree (shop_id, lower(name));

CREATE INDEX shops_collection ON public.shops USING btree (collection_id);

CREATE UNIQUE INDEX shops_slug ON public.shops USING btree (slug) WHERE (slug IS NOT NULL);

CREATE INDEX shops_slug_held ON public.shops USING btree (slug_held_at) WHERE slug_held;

CREATE UNIQUE INDEX staff_account_per_shop ON public.staff USING btree (shop_id, account_id) WHERE (account_id IS NOT NULL);

CREATE INDEX staff_shop ON public.staff USING btree (shop_id) WHERE active;

CREATE UNIQUE INDEX tags_owner_name ON public.tags USING btree (owner_id, lower(name));

CREATE INDEX tax_ledger_period ON public.tax_ledger USING btree (shop_id, period);

CREATE INDEX tax_ledger_source ON public.tax_ledger USING btree (source_kind, source_id);

CREATE INDEX webhook_deliveries_due ON public.webhook_deliveries USING btree (next_attempt_at) WHERE (status = 'pending'::text);

CREATE INDEX webhook_endpoints_owner ON public.webhook_endpoints USING btree (owner_id);

CREATE TRIGGER consent_written_once BEFORE UPDATE ON privacy.consent FOR EACH ROW EXECUTE FUNCTION privacy.consent_written_once();

CREATE TRIGGER incident_guard BEFORE DELETE OR UPDATE ON privacy.incident FOR EACH ROW EXECUTE FUNCTION privacy.incident_guard();

CREATE TRIGGER ak_shop_default BEFORE INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION public.ak_shop_default();

CREATE TRIGGER ak_shop_owner_member AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION public.ak_shop_owner_member();

CREATE TRIGGER bookings_rules BEFORE INSERT OR UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.ak_booking_rules();

CREATE CONSTRAINT TRIGGER collections_exactly_one_default AFTER INSERT OR DELETE OR UPDATE ON public.collections DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.collections_exactly_one_default();

CREATE TRIGGER collections_guard_default BEFORE DELETE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.collections_guard_default();

CREATE TRIGGER collections_owner_default AFTER INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.collections_owner_default();

CREATE TRIGGER invoice_lines_written_once BEFORE DELETE OR UPDATE ON public.invoice_lines FOR EACH ROW EXECUTE FUNCTION public.ak_written_once();

CREATE CONSTRAINT TRIGGER invoices_balanced AFTER INSERT ON public.invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.ak_invoice_balanced();

CREATE TRIGGER invoices_written_once BEFORE DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.ak_written_once();

CREATE TRIGGER shop_search_services AFTER INSERT OR DELETE OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.shop_search_of_child();

CREATE TRIGGER shop_search_shop_ins AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION public.shop_search_of_shop();

CREATE TRIGGER shop_search_shop_upd AFTER UPDATE OF name, kind, area, tagline_fr, tagline_en, timezone, slug, published, slug_held ON public.shops FOR EACH ROW EXECUTE FUNCTION public.shop_search_of_shop();

CREATE TRIGGER shop_search_stale_appointments AFTER INSERT OR DELETE OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.shop_search_stale_of_shop_row();

CREATE TRIGGER shop_search_stale_bookings AFTER INSERT OR DELETE OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.shop_search_stale_of_booking();

CREATE TRIGGER shop_search_stale_busy AFTER INSERT OR DELETE OR UPDATE ON public.busy_intervals FOR EACH ROW EXECUTE FUNCTION public.shop_search_stale_of_shop_row();

CREATE TRIGGER shop_search_stale_days_off AFTER INSERT OR DELETE OR UPDATE ON public.days_off FOR EACH ROW EXECUTE FUNCTION public.shop_search_stale_of_staff_row();

CREATE TRIGGER shop_search_stale_rules AFTER INSERT OR DELETE OR UPDATE ON public.shop_rules FOR EACH ROW EXECUTE FUNCTION public.shop_search_stale_of_shop_row();

CREATE TRIGGER shop_search_stale_schedules AFTER INSERT OR DELETE OR UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.shop_search_stale_of_staff_row();

CREATE TRIGGER shop_search_stale_staff AFTER INSERT OR DELETE OR UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.shop_search_stale_of_shop_row();

CREATE TRIGGER shop_search_zones AFTER INSERT OR DELETE OR UPDATE ON public.shop_zones FOR EACH ROW EXECUTE FUNCTION public.shop_search_of_child();

CREATE TRIGGER shops_default_collection BEFORE INSERT OR UPDATE OF collection_id ON public.shops FOR EACH ROW WHEN ((new.collection_id IS NULL)) EXECUTE FUNCTION public.shops_default_collection();

CREATE TRIGGER shops_slug_history BEFORE INSERT OR UPDATE OF slug ON public.shops FOR EACH ROW EXECUTE FUNCTION public.ak_shop_slug_history();

CREATE TRIGGER tax_ledger_source BEFORE INSERT ON public.tax_ledger FOR EACH ROW EXECUTE FUNCTION public.ak_ledger_source();

CREATE TRIGGER tax_ledger_written_once BEFORE DELETE OR UPDATE ON public.tax_ledger FOR EACH ROW EXECUTE FUNCTION public.ak_written_once();

ALTER TABLE ONLY organize.client_status
    ADD CONSTRAINT client_status_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY organize.client_status
    ADD CONSTRAINT client_status_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY organize.client_tag
    ADD CONSTRAINT client_tag_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY organize.client_tag
    ADD CONSTRAINT client_tag_tag_id_kind_fkey FOREIGN KEY (tag_id, kind) REFERENCES organize.tag(id, kind) ON DELETE CASCADE;

ALTER TABLE ONLY organize.invoice_status
    ADD CONSTRAINT invoice_status_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY organize.invoice_status
    ADD CONSTRAINT invoice_status_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY organize.invoice_tag
    ADD CONSTRAINT invoice_tag_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY organize.invoice_tag
    ADD CONSTRAINT invoice_tag_tag_id_kind_fkey FOREIGN KEY (tag_id, kind) REFERENCES organize.tag(id, kind) ON DELETE CASCADE;

ALTER TABLE ONLY organize.kind_config
    ADD CONSTRAINT kind_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY organize.tag
    ADD CONSTRAINT tag_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY organize.view
    ADD CONSTRAINT view_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY organize.view
    ADD CONSTRAINT view_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_rotated_from_id_fkey FOREIGN KEY (rotated_from_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id);

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_shop_id_shops_id_fk FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.shop_zones(id);

ALTER TABLE ONLY public.association_proofs
    ADD CONSTRAINT association_proofs_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.association_proofs
    ADD CONSTRAINT association_proofs_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_dependant_id_fkey FOREIGN KEY (dependant_id) REFERENCES public.dependants(id);

ALTER TABLE ONLY public.brief_actions
    ADD CONSTRAINT brief_actions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.brief_deliveries
    ADD CONSTRAINT brief_deliveries_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.busy_intervals
    ADD CONSTRAINT busy_intervals_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.calendar_connections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.busy_intervals
    ADD CONSTRAINT busy_intervals_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.busy_intervals
    ADD CONSTRAINT busy_intervals_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_notes
    ADD CONSTRAINT client_notes_author_account_id_fkey FOREIGN KEY (author_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.client_notes
    ADD CONSTRAINT client_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_notes
    ADD CONSTRAINT client_notes_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_request_files
    ADD CONSTRAINT client_request_files_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.client_requests(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.client_requests
    ADD CONSTRAINT client_requests_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.shop_zones(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_shop_id_shops_id_fk FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collections_tags
    ADD CONSTRAINT collections_tags_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.collections_tags
    ADD CONSTRAINT collections_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.days_off
    ADD CONSTRAINT days_off_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dependants
    ADD CONSTRAINT dependants_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dependants
    ADD CONSTRAINT dependants_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_changes
    ADD CONSTRAINT email_changes_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_shop_id_shops_id_fk FOREIGN KEY (shop_id) REFERENCES public.shops(id);

ALTER TABLE ONLY public.feed_tokens
    ADD CONSTRAINT feed_tokens_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feed_tokens
    ADD CONSTRAINT feed_tokens_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invoice_deliveries
    ADD CONSTRAINT invoice_deliveries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_appointment_id_appointments_id_fk FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_replaces_fkey FOREIGN KEY (replaces) REFERENCES public.invoices(id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_shop_id_shops_id_fk FOREIGN KEY (shop_id) REFERENCES public.shops(id);

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_shop_id_shops_id_fk FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_account_id_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_announcements
    ADD CONSTRAINT shop_announcements_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_domains
    ADD CONSTRAINT shop_domains_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_figure_rules
    ADD CONSTRAINT shop_figure_rules_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_former_slugs
    ADD CONSTRAINT shop_former_slugs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_languages
    ADD CONSTRAINT shop_languages_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_media
    ADD CONSTRAINT shop_media_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_page
    ADD CONSTRAINT shop_page_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_page_versions
    ADD CONSTRAINT shop_page_versions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_reels
    ADD CONSTRAINT shop_reels_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_reviews
    ADD CONSTRAINT shop_reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shop_reviews
    ADD CONSTRAINT shop_reviews_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_rules
    ADD CONSTRAINT shop_rules_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_search
    ADD CONSTRAINT shop_search_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_slug_changes
    ADD CONSTRAINT shop_slug_changes_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_social_links
    ADD CONSTRAINT shop_social_links_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_tags
    ADD CONSTRAINT shop_tags_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_tags
    ADD CONSTRAINT shop_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_translation_runs
    ADD CONSTRAINT shop_translation_runs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_translations
    ADD CONSTRAINT shop_translations_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_wall_items
    ADD CONSTRAINT shop_wall_items_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_wall
    ADD CONSTRAINT shop_wall_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shop_zones
    ADD CONSTRAINT shop_zones_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_owner_id_accounts_id_fk FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_shop_id_shops_id_fk FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tax_ledger
    ADD CONSTRAINT tax_ledger_shop_id_shops_id_fk FOREIGN KEY (shop_id) REFERENCES public.shops(id);

ALTER TABLE ONLY public.visit_reports
    ADD CONSTRAINT visit_reports_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

INSERT INTO public.krizaka_module_versions (module, version, checksum) VALUES ('privacy', 1, '1c0fbc2cedba58b2034b666555621389230bfef102dd6b5f7fcf54302a6d3464');
INSERT INTO public.krizaka_module_versions (module, version, checksum) VALUES ('privacy', 2, '17f9b2e4492024745aa5ac4c82141b8781439a26974c6dafa922da5ae1eaeee7');
