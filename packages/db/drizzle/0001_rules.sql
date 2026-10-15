-- The rules the database keeps itself, whatever the code above it does. Each refusal names itself (AK_…).

-- 1. Nobody is booked twice at once: two live appointments of one staff member never overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE appointments ADD CONSTRAINT appointments_no_double_booking
  EXCLUDE USING gist (staff_id WITH =, during WITH &&) WHERE (status <> 'cancelled');
--> statement-breakpoint

-- 2. An issued invoice, its lines, the ledger and the consents are written once: a correction is a credit note, a new
--    entry, a new decision — never an edit.
CREATE FUNCTION ak_written_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AK_WRITTEN_ONCE: % rows are never updated or deleted (a correction is a new entry)', TG_TABLE_NAME;
END $$;
--> statement-breakpoint
CREATE TRIGGER invoices_written_once BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION ak_written_once();
--> statement-breakpoint
CREATE TRIGGER invoice_lines_written_once BEFORE UPDATE OR DELETE ON invoice_lines FOR EACH ROW EXECUTE FUNCTION ak_written_once();
--> statement-breakpoint
CREATE TRIGGER tax_ledger_written_once BEFORE UPDATE OR DELETE ON tax_ledger FOR EACH ROW EXECUTE FUNCTION ak_written_once();
--> statement-breakpoint
CREATE TRIGGER client_consents_written_once BEFORE UPDATE OR DELETE ON client_consents FOR EACH ROW EXECUTE FUNCTION ak_written_once();
--> statement-breakpoint

-- 3. At commit, an invoice adds up: its lines make its subtotal, and the ledger holds exactly its GST and its QST.
CREATE FUNCTION ak_invoice_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
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
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER invoices_balanced AFTER INSERT ON invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ak_invoice_balanced();
--> statement-breakpoint

-- 4. A ledger entry's period is the month of its source, and a shop's entries are its own.
CREATE FUNCTION ak_ledger_source() RETURNS trigger LANGUAGE plpgsql AS $$
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
--> statement-breakpoint
CREATE TRIGGER tax_ledger_source BEFORE INSERT ON tax_ledger FOR EACH ROW EXECUTE FUNCTION ak_ledger_source();
