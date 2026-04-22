export interface AvailableSlot {
  start: Date;
  end: Date;
}

export interface CalendarEvent {
  googleEventId: string;
  meetLink?: string;
}

export interface ICalendarService {
  /** Return up to 5 free 1-hour slots for an interviewer over the next N business days. */
  getAvailableSlots(
    interviewerEmail: string,
    dateStart: Date,
    dateEnd: Date,
    slotDurationMinutes?: number
  ): Promise<AvailableSlot[]>;

  /** Create a tentative hold event. Returns event ID + Meet link. */
  holdSlot(
    interviewerEmail: string,
    candidateName: string,
    candidateEmail: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarEvent>;

  /** Delete a hold or confirmed event (sends cancellation to attendees). */
  releaseSlot(interviewerEmail: string, googleEventId: string): Promise<void>;

  /**
   * Promote a tentative hold to a confirmed event: update title, set status to confirmed,
   * send invites to all attendees, and optionally add extra attendees (e.g. Fireflies bot).
   * Returns the Google Meet URL, or undefined if unavailable.
   */
  confirmEvent(
    interviewerEmail: string,
    googleEventId: string,
    candidateName: string,
    additionalAttendees?: string[]
  ): Promise<string | undefined>;
}
