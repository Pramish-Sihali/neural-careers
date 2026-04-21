import type { ICalendarService } from "./ICalendarService";
import { MockCalendarService } from "./MockCalendarService";
import { GoogleCalendarService } from "./GoogleCalendarService";

export function getCalendarService(): ICalendarService {
  if (process.env.USE_MOCK_CALENDAR === "true") {
    return new MockCalendarService();
  }
  return new GoogleCalendarService();
}

export type { ICalendarService, AvailableSlot, CalendarEvent } from "./ICalendarService";
