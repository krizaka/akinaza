/** Aujourd'hui's board (D4): what the day's page reads from the bookings and the ledger (`todayBoard` of @akinaza/db). */
/** The periods of the activity strip, in days (`?period=`). */
// @fixed: the activity strip's three periods (7, 30 and 90 days), named by the direction (B2)
export const BOARD_PERIODS = [7, 30, 90] as const;
export type BoardPeriod = (typeof BOARD_PERIODS)[number];

export interface TodayBoard {
  /** The week's appointments (Monday to Sunday around `day`), cancelled and missed ones aside. */
  week: number;
  /** Finished appointments of the last month that no invoice names yet, oldest first. */
  toBill: { appointmentId: string; clientId: string | null; client: string | null; serviceId: string; startsAt: string }[];
  /** The activity of the `period` days ending on `day`, one value per day, oldest first, in integer cents. */
  activity: { days: string[]; invoicedCents: number[]; collectedCents: number[]; appointments: number[] };
  /** What is still to collect (due, partly paid, overdue: `invoiceState`), and how much of it is late. */
  balance: { owedCents: number; overdueCents: number; count: number; overdueCount: number };
  /** The invoice to chase first: the oldest overdue, else the next one due. */
  chase: { id: string; number: string; client: string | null; dueOn: string | null; remainingCents: number; overdue: boolean } | null;
}

