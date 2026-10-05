/**
 * Pickup schedule. Customers choose a pickup slot at checkout from these
 * hours only. Times are local to the shop (British Columbia).
 */
export const pickup = {
  timeZone: "America/Vancouver",
  /**
   * Prints take about 2 to 5 days. The earliest pickup day offered is this
   * many days after the order, so every order is ready in time.
   */
  minLeadDays: 5,
  /** How far ahead customers can book. */
  maxDaysAhead: 21,
  /** Length of each pickup slot, in minutes. */
  slotMinutes: 60,
  /**
   * Open hours per weekday, 24-hour clock [open, close].
   * 0 = Sunday ... 6 = Saturday. null = closed that day.
   */
  hours: {
    0: [9, 21], // Sunday 9 am to 9 pm
    1: [16, 20], // Monday 4 pm to 8 pm
    2: [16, 20],
    3: [16, 20],
    4: [16, 20],
    5: [16, 20], // Friday
    6: [9, 21], // Saturday
  } as Record<number, [number, number] | null>,
  /** Days you're unavailable, "YYYY-MM-DD" (holidays, trips). */
  closedDates: [] as string[],
};

export type PickupConfig = typeof pickup;
