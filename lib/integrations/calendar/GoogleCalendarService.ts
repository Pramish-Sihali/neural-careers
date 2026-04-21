import { google } from "googleapis";
import { randomUUID } from "crypto";
import { getAuthorizedClient } from "./googleOAuth";
import type { ICalendarService, AvailableSlot, CalendarEvent } from "./ICalendarService";

const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE ?? "UTC";
const SLOT_HOURS = [9, 10, 11, 13, 14, 15, 16]; // candidate-facing working hours

export class GoogleCalendarService implements ICalendarService {
  async getAvailableSlots(
    interviewerEmail: string,
    dateStart: Date,
    dateEnd: Date,
    slotDurationMinutes = 60
  ): Promise<AvailableSlot[]> {
    const auth = await getAuthorizedClient(interviewerEmail);
    const calendar = google.calendar({ version: "v3", auth });

    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: dateStart.toISOString(),
        timeMax: dateEnd.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: "primary" }],
      },
    });

    const busy = data.calendars?.primary?.busy ?? [];

    // Generate candidate slots across working hours for each day in range
    const slots: AvailableSlot[] = [];
    const cursor = new Date(dateStart);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= dateEnd && slots.length < 5) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        for (const hour of SLOT_HOURS) {
          if (slots.length >= 5) break;
          const start = new Date(cursor);
          start.setHours(hour, 0, 0, 0);
          const end = new Date(start.getTime() + slotDurationMinutes * 60_000);

          const isBusy = busy.some(
            (b) =>
              new Date(b.start!) < end && new Date(b.end!) > start
          );

          if (!isBusy) slots.push({ start, end });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return slots;
  }

  async holdSlot(
    interviewerEmail: string,
    candidateName: string,
    candidateEmail: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent> {
    const auth = await getAuthorizedClient(interviewerEmail);
    const calendar = google.calendar({ version: "v3", auth });

    const { data } = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      sendUpdates: "none", // invites sent only on confirmation, not on hold
      requestBody: {
        summary: `[Hold] Interview: ${candidateName}`,
        start: { dateTime: startTime.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: endTime.toISOString(), timeZone: TIMEZONE },
        attendees: [
          { email: interviewerEmail },
          { email: candidateEmail, displayName: candidateName, responseStatus: "needsAction" },
        ],
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        status: "tentative",
      },
    });

    const meetLink =
      data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri;

    return {
      googleEventId: data.id!,
      meetLink: meetLink ?? undefined,
    };
  }

  async releaseSlot(
    interviewerEmail: string,
    googleEventId: string
  ): Promise<void> {
    const auth = await getAuthorizedClient(interviewerEmail);
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "none",
    }).catch(() => {
      // Event may already be deleted — safe to ignore
    });
  }

  /** Confirm a held event: update title, set confirmed status, send invites. */
  async confirmEvent(
    interviewerEmail: string,
    googleEventId: string,
    candidateName: string
  ): Promise<string | undefined> {
    const auth = await getAuthorizedClient(interviewerEmail);
    const calendar = google.calendar({ version: "v3", auth });

    const { data } = await calendar.events.patch({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all", // sends calendar invites to both attendees
      requestBody: {
        summary: `Interview: ${candidateName}`,
        status: "confirmed",
      },
    });

    return data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri ?? undefined;
  }
}
