-- Explorer's « next free time » (akinaza#574, ADR-006 decision 4, CTO decision): the slot engine is the one costly fact of the list
-- (0.9-1.7 s cold for 30 shops), so each shop's answer is computed once and stored on its read model row. The facts of a row:
--   next_free_at  the first time a client could book (any of the shop's first services), null = none in the coming days
--   open_week     a weekly window still to come in the next 7 local days, not a day off
--   avail_day     the shop's local day the two were computed for (a new day makes the row due)
--   avail_at      the clock they were computed at (a sweep run with an earlier clock, as a test does, redoes the row)
--   avail_stale   something the answer depends on changed since: a booking, hours, a day off, a rule, a service, a calendar
-- Triggers only raise the flag (cheap, same transaction as the writer); the sweep (`settleAvailability`, a tick of the server)
-- recomputes the due rows with the injected clock. The shop page still computes live.
ALTER TABLE shop_search
  ADD COLUMN next_free_at timestamptz,
  ADD COLUMN open_week boolean NOT NULL DEFAULT false,
  ADD COLUMN avail_day date,
  ADD COLUMN avail_at timestamptz,
  ADD COLUMN avail_stale boolean NOT NULL DEFAULT true;
CREATE INDEX shop_search_due ON shop_search (avail_stale) WHERE avail_stale;

CREATE FUNCTION mark_shop_search_stale(p_shop uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE shop_search SET avail_stale = true WHERE shop_id = p_shop AND NOT avail_stale $$;

-- A shop change that rebuilds the row (timezone, publication) also makes its answer due.
CREATE OR REPLACE FUNCTION shop_search_of_shop() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM refresh_shop_search(NEW.id); PERFORM mark_shop_search_stale(NEW.id); RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION shop_search_of_child() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM refresh_shop_search(COALESCE(NEW.shop_id, OLD.shop_id)); PERFORM mark_shop_search_stale(COALESCE(NEW.shop_id, OLD.shop_id)); RETURN NULL; END $$;

-- The writers that move the answer without touching the search words.
CREATE FUNCTION shop_search_stale_of_shop_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM mark_shop_search_stale(COALESCE(NEW.shop_id, OLD.shop_id)); RETURN NULL; END $$;
CREATE FUNCTION shop_search_stale_of_staff_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM mark_shop_search_stale(s.shop_id) FROM staff s WHERE s.id = COALESCE(NEW.staff_id, OLD.staff_id); RETURN NULL; END $$;
CREATE FUNCTION shop_search_stale_of_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM mark_shop_search_stale(a.shop_id) FROM appointments a WHERE a.id = COALESCE(NEW.appointment_id, OLD.appointment_id); RETURN NULL; END $$;

CREATE TRIGGER shop_search_stale_appointments AFTER INSERT OR UPDATE OR DELETE ON appointments FOR EACH ROW EXECUTE FUNCTION shop_search_stale_of_shop_row();
CREATE TRIGGER shop_search_stale_bookings AFTER INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION shop_search_stale_of_booking();
CREATE TRIGGER shop_search_stale_rules AFTER INSERT OR UPDATE OR DELETE ON shop_rules FOR EACH ROW EXECUTE FUNCTION shop_search_stale_of_shop_row();
CREATE TRIGGER shop_search_stale_staff AFTER INSERT OR UPDATE OR DELETE ON staff FOR EACH ROW EXECUTE FUNCTION shop_search_stale_of_shop_row();
CREATE TRIGGER shop_search_stale_busy AFTER INSERT OR UPDATE OR DELETE ON busy_intervals FOR EACH ROW EXECUTE FUNCTION shop_search_stale_of_shop_row();
CREATE TRIGGER shop_search_stale_schedules AFTER INSERT OR UPDATE OR DELETE ON schedules FOR EACH ROW EXECUTE FUNCTION shop_search_stale_of_staff_row();
CREATE TRIGGER shop_search_stale_days_off AFTER INSERT OR UPDATE OR DELETE ON days_off FOR EACH ROW EXECUTE FUNCTION shop_search_stale_of_staff_row();
