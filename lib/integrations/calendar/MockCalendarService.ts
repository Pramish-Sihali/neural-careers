import { randomUUID } from "crypto";
import type { ICalendarService, AvailableSlot, CalendarEvent } from "./ICalendarService";

export class MockCalendarService implements ICalendarService {
  async getAvailableSlots(
    _interviewerEmail: string,
    dateStart: Date,
    _dateEnd: Date,
    slotDurationMinutes = 60
  ): Promise<AvailableSlot[]> {
    const slots: AvailableSlot[] = [];
    const cursor = new Date(dateStart);
    cursor.setHours(9, 0, 0, 0);

    while (slots.length < 5) {
      const day = cursor.getDay();
      // Skip weekends
      if (day !== 0 && day !== 6) {
        // Offer 9am, 11am, 2pm slots per day
        for (const hour of [9, 11, 14]) {
          if (slots.length >= 5) break;
          const start = new Date(cursor);
          start.setHours(hour, 0, 0, 0);
          const end = new Date(start.getTime() + slotDurationMinutes * 60_000);
          slots.push({ start, end });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return slots;
  }

  async holdSlot(
    _interviewerEmail: string,
    _candidateName: string,
    _candidateEmail: string,
    _startTime: Date,
    _endTime: Date
  ): Promise<CalendarEvent> {
    return {
      googleEventId: `mock-${randomUUID().slice(0, 8)}`,
      meetLink: `https://meet.google.com/mock-${randomUUID().slice(0, 6)}`,
    };
  }

  async releaseSlot(
    _interviewerEmail: string,
    _googleEventId: string
  ): Promise<void> {
    // no-op in mock
  }
}
