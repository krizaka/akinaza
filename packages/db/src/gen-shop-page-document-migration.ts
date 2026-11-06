import { SHOP_PAGE_DOCUMENT_MIGRATION_SQL } from "./shop-page-document-migration";

/** `pnpm --filter @folioviv/db exec tsx src/gen-shop-page-document-migration.ts > drizzle/0038_shop_page_document.sql` */
process.stdout.write(SHOP_PAGE_DOCUMENT_MIGRATION_SQL);
