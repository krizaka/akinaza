-- Merchants' own domains (ADR-005 §3, akinaza#539): a paid option an administrator enables per shop, then the domains the owner adds.
-- Ownership by a TXT record (a random token per shop and domain, never reused), TLS per hostname at the edge service, served only when `active`.
ALTER TABLE shops ADD COLUMN custom_domain_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE shops ADD COLUMN custom_domain_price_version text;
ALTER TABLE shops ADD COLUMN custom_domain_enabled_at timestamptz;

CREATE TABLE shop_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  hostname text NOT NULL CHECK (hostname = lower(hostname)),
  state text NOT NULL DEFAULT 'pending-txt' CHECK (state IN ('pending-txt','pending-tls','active','failed','suspended','removed')),
  token text NOT NULL,
  provider_id text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- A hostname is claimed by one shop at a time, once its TXT was proven (pending-tls, active). Pending, failed and suspended rows claim nothing, so an
-- unproven claim, or a lapsed one, never blocks the real owner; a released domain (removed) needs a new row, hence a new token and a new proof.
CREATE UNIQUE INDEX shop_domains_claim ON shop_domains (hostname) WHERE state IN ('pending-tls','active');
CREATE INDEX shop_domains_shop ON shop_domains (shop_id) WHERE state <> 'removed';
CREATE INDEX shop_domains_due ON shop_domains (last_checked_at NULLS FIRST) WHERE state IN ('pending-txt','pending-tls','active');
