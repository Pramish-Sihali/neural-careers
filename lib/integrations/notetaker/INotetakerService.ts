// lib/integrations/notetaker/INotetakerService.ts

export interface FirefliesSentence {
  speaker_name: string;
  text: string;
  start_time: number;
  end_time: number;
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  duration: number;
  sentences: FirefliesSentence[];
  summary?: {
    overview: string;
    action_items?: string[];
    keywords?: string[];
  };
}

export interface NotetakerContext {
  candidateName: string;
}

export interface AddToMeetingResult {
  success: boolean;
  message: string;
}

export interface INotetakerService {
  /**
   * Fetch transcript for a meeting.
   * context.candidateName is used by MockNotetakerService to generate realistic data.
   * FirefliesNotetakerService ignores context — it fetches from the API by meetingId.
   */
  fetchTranscript(
    meetingId: string,
    context?: NotetakerContext
  ): Promise<FirefliesTranscript>;

  /**
   * Send the Fireflies bot into an already-running meeting.
   * The meeting must be active and have at least one participant.
   * Returns { success: false, message } when Fireflies rejects the request.
   */
  addToMeeting(meetingUrl: string): Promise<AddToMeetingResult>;
}
