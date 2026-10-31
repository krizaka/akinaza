import { bookVisit, ownerOfShop } from "@akinaza/db";

import { requestNow } from "@/app/request-now";
import { systemClock } from "@/app/system-clock";
import { type ReceiptRecipient,sendBookingReceipt } from "@/lib/booking-receipt";
import { db } from "@/lib/db";
import { announceSlots } from "@/lib/realtime";
import { emitWebhook } from "@/lib/webhooks";

export interface VisitRequest {
  clientId: string;
  shopId: string;
  serviceId: string;
  zoneId: string | null;
  dependantIds: string[];
  startsAt: string;
  staffId?: string | null;
  /** Who gets the receipt by e-mail (a failed mail never undoes the booking). */
  receiptTo?: ReceiptRecipient;
}

/** The one booking path of the API: the domain books (the database refuses a taken time), the live slots are told, the owner's webhook is sent. A signed-in client and a guest both come through here. */
export async function bookAndAnnounce(input: VisitRequest) {
  const result = await bookVisit(db(), { clientId: input.clientId, serviceId: input.serviceId, zoneId: input.zoneId, dependantIds: input.dependantIds, startsAt: new Date(input.startsAt), now: requestNow(), staffId: input.staffId });
  await announceSlots(input.shopId);
  await emitWebhook(await ownerOfShop(db(), input.shopId), { id: `appointment:${result.appointmentId}`, type: "booking.created", payload: { appointmentId: result.appointmentId, bookingIds: result.bookingIds, shopId: input.shopId, clientId: input.clientId, serviceId: input.serviceId, startsAt: new Date(input.startsAt).toISOString() } }, systemClock.now());
  if (input.receiptTo && result.bookingIds[0]) {
    try {
      await sendBookingReceipt(input.receiptTo, result.bookingIds[0]);
    } catch {
      // The booking stands; the receipt is on the confirmation page.
    }
  }
  return result;
}
