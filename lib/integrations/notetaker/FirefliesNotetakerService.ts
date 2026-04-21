// lib/integrations/notetaker/FirefliesNotetakerService.ts

import type { INotetakerService, FirefliesTranscript, NotetakerContext } from "./INotetakerService";

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

const TRANSCRIPT_QUERY = `
  query GetTranscript($meetingId: String!) {
    transcript(id: $meetingId) {
      id
      title
      date
      duration
      sentences {
        speaker_name
        text
        start_time
        end_time
      }
      summary {
        overview
        action_items
        keywords
      }
    }
  }
`;

export class FirefliesNotetakerService implements INotetakerService {
  // context is accepted for interface compatibility but unused — real data comes from the API
  async fetchTranscript(
    meetingId: string,
    _context?: NotetakerContext
  ): Promise<FirefliesTranscript> {
    const res = await fetch(FIREFLIES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({ query: TRANSCRIPT_QUERY, variables: { meetingId } }),
    });

    if (!res.ok) {
      throw new Error(`Fireflies API error: ${res.status} ${res.statusText}`);
    }

    const { data, errors } = (await res.json()) as {
      data?: { transcript: FirefliesTranscript };
      errors?: Array<{ message: string }>;
    };

    if (errors?.length) {
      throw new Error(`Fireflies GraphQL error: ${errors[0].message}`);
    }

    if (!data?.transcript) {
      throw new Error(`Transcript not found for meetingId: ${meetingId}`);
    }

    return data.transcript;
  }
}
