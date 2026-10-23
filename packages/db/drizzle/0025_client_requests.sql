-- « Mes demandes » (krizaka/akinaza#210): a client keeps a request at a shop — a service, a preferred person, an area, a
-- note, attachments — and renews it in one tap. The files live on the media storage; only their address is kept here.
-- A request belongs to the client's file at the shop: deleting it, or erasing the client, removes it and its files.
CREATE TABLE IF NOT EXISTS client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES shop_zones(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_requests_client ON client_requests(client_id);

CREATE TABLE IF NOT EXISTS client_request_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image', 'pdf')),
  bytes integer NOT NULL CHECK (bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_request_files_request ON client_request_files(request_id);
