-- Roles per shop (@krizaka/auth, #180): memberships and invitations; every shop's owner is its owner member.
CREATE TABLE IF NOT EXISTS memberships (
  scope_id   uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  invited_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope_id, account_id)
);
CREATE INDEX IF NOT EXISTS memberships_account ON memberships(account_id);
CREATE TABLE IF NOT EXISTS invitations (
  id         uuid PRIMARY KEY,
  scope_id   uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  email      text NOT NULL CHECK (email = lower(email)),
  role       text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
CREATE INDEX IF NOT EXISTS invitations_scope ON invitations(scope_id) WHERE used_at IS NULL;
INSERT INTO memberships (scope_id, account_id, role, invited_by, created_at) SELECT id, owner_id, 'owner', NULL, created_at FROM shops WHERE owner_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE FUNCTION ak_shop_owner_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO memberships (scope_id, account_id, role, invited_by, created_at) VALUES (NEW.id, NEW.owner_id, 'owner', NULL, now()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ak_shop_owner_member AFTER INSERT ON shops FOR EACH ROW EXECUTE FUNCTION ak_shop_owner_member();
ALTER TABLE staff ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX staff_account_per_shop ON staff(shop_id, account_id) WHERE account_id IS NOT NULL;
