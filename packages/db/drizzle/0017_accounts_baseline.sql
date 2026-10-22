-- The account baseline (@krizaka/auth): name, theme, avatar seed, verified e-mail, e-mail changes by link.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name text CHECK (name IS NULL OR char_length(name) <= 80);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_seed text CHECK (avatar_seed IS NULL OR avatar_seed ~ '^[a-z0-9-]{1,40}$');
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS theme text CHECK (theme IS NULL OR theme IN ('light', 'dark', 'system'));
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE accounts SET email_verified_at = created_at WHERE email_verified_at IS NULL;
CREATE TABLE IF NOT EXISTS email_changes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  new_email  text NOT NULL CHECK (new_email = lower(new_email)),
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
