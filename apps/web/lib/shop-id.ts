/** A shop is named in addresses by its id: anything else in that place is not a shop. */
const SHOP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isShopId = (value: string): boolean => SHOP_ID.test(value);

