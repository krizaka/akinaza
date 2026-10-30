/**
 * « On quote » (akinaza#489): an offer that has no list price — custom modules, maintenance — says so rather than « Free » or « $0 ».
 * No column: a service whose price « varies » and lists nothing (0) is on quote; a free service does not vary.
 */
export const isOnQuote = (service: { priceCents: number; priceVaries: boolean }): boolean => service.priceVaries && service.priceCents === 0;
