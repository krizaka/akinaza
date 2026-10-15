import type { Db } from "../client";
import { clients, services, shops, staff } from "../schema";

/** A Montréal hair salon, registered for the taxes, with two stylists, two services and a client. */
export async function salon(db: Db, opts: { registrant?: boolean } = {}) {
  const registrant = opts.registrant ?? true;
  const [shop] = await db
    .insert(shops)
    .values({ name: "Salon Laurier", legalName: "Salon Laurier inc.", kind: "salon", registrant, gstNumber: registrant ? "123456789RT0001" : null, qstNumber: registrant ? "1234567890TQ0001" : null, address: "1234 av. Laurier E., Montréal QC" })
    .returning();
  const [julie, marc] = await db.insert(staff).values([{ shopId: shop!.id, name: "Julie" }, { shopId: shop!.id, name: "Marc" }]).returning();
  const [cut, colour] = await db
    .insert(services)
    .values([
      { shopId: shop!.id, nameFr: "Coupe", nameEn: "Haircut", durationMinutes: 45, priceCents: 4_500 },
      { shopId: shop!.id, nameFr: "Coloration", nameEn: "Colour", durationMinutes: 90, priceCents: 9_500 },
    ])
    .returning();
  const [client] = await db.insert(clients).values({ shopId: shop!.id, fullName: "Camille Tremblay", email: "camille@example.test", phone: "514-555-0199", language: "fr" }).returning();
  return { shop: shop!, staff: { julie: julie!, marc: marc! }, services: { cut: cut!, colour: colour! }, client: client! };
}
