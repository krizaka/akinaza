-- A visitor books without an account (krizaka-internal#1909): the booking is held here until the code mailed to the visitor comes back.
-- Only the salted proof of address + code is kept, never the code; the held request (name, address, phone, the chosen time) lives 15 minutes
-- at most and is deleted when used, when it expires or when the purge runs (Loi 25: purpose = confirm the booking, retention = the code's life).
CREATE TABLE booking_codes (
  id text PRIMARY KEY,
  proof text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_codes_expires ON booking_codes (expires_at);
