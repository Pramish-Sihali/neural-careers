import type { ICalendarService } from "./ICalendarService";
import { MockCalendarService } from "./MockCalendarService";

export function getCalendarService(): ICalendarService {
  if (process.env.USE_MOCK_CALENDAR === "true") {
    return new MockCalendarService();
  }
  // Real GoogleCalendarService wired in Phase 03 part 2
  throw new Error(
    "USE_MOCK_CALENDAR is not set to true and GoogleCalendarService is not yet implemented. Set USE_MOCK_CALENDAR=true in .env.local."
  );
}

export type { ICalendarService, AvailableSlot, CalendarEvent } from "./ICalendarService";
