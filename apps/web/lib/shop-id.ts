/** Ids are UUIDs: a segment of an address that is not one names nothing, and must answer 404 before the database is asked (it would answer 500). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);

/** A shop is named in addresses by its id. */
export const isShopId = isUuid;
