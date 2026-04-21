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
}
