import { rolesMigration } from "@krizaka/auth";

import { SHOP_ROLES } from "./roles";

/**
 * Migration 0020, generated from the shared block (a test fails when the file and the block drift apart): memberships and invitations of a shop,
 * then what is Akinaza's own — the owner of every shop is its `owner` member (a shop created for an owner makes it, in the database), and a
 * team member's sign-in may be tied to the staff entry that clients book « with ».
 */
export const ROLES_MIGRATION_HEADER = "-- Roles per shop (@krizaka/auth, #180): memberships and invitations; every shop's owner is its owner member.\n";
export const ROLES_MIGRATION_OWN = `
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
`;
export const ROLES_MIGRATION_SQL = ROLES_MIGRATION_HEADER + rolesMigration(SHOP_ROLES.roles, { scopeTable: "shops" }).trimStart() + ROLES_MIGRATION_OWN.trimStart();
