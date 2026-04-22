// lib/integrations/notetaker/MockNotetakerService.ts

import type { INotetakerService, FirefliesTranscript, NotetakerContext, AddToMeetingResult } from "./INotetakerService";

export class MockNotetakerService implements INotetakerService {
  async fetchTranscript(
    meetingId: string,
    context?: NotetakerContext
  ): Promise<FirefliesTranscript> {
    const name = context?.candidateName ?? "Candidate";

    return {
      id: `mock_${meetingId}`,
      title: `Interview with ${name}`,
      date: new Date().toISOString(),
      duration: 45,
      sentences: [
        { speaker_name: "Interviewer", text: "Thanks for joining. Can you walk me through your background?", start_time: 0, end_time: 6 },
        { speaker_name: name, text: "Of course! I have 5 years in full-stack development, primarily TypeScript and React. In my last role I led a team of 3 engineers rebuilding our core platform.", start_time: 6, end_time: 18 },
        { speaker_name: "Interviewer", text: "What has been your most technically challenging project?", start_time: 18, end_time: 22 },
        { speaker_name: name, text: "Migrating a monolith to microservices under zero-downtime constraints. We used feature flags and a strangler fig pattern — took 6 months but succeeded.", start_time: 22, end_time: 34 },
        { speaker_name: "Interviewer", text: "How do you handle disagreements with product managers about technical trade-offs?", start_time: 34, end_time: 40 },
        { speaker_name: name, text: "I try to quantify the cost of cutting corners. If we skip tests now, I estimate the future bug rate and remediation cost. That converts abstract tech debt into concrete business risk.", start_time: 40, end_time: 52 },
      ],
      summary: {
        overview: `${name} demonstrated strong full-stack experience and systems thinking. Clearly articulated migration strategy and showed pragmatic approach to technical trade-offs. Good communicator.`,
        action_items: ["Request code sample from previous migration project", "Check references"],
        keywords: ["TypeScript", "React", "microservices", "team lead", "feature flags"],
      },
    };
  }

  async addToMeeting(_meetingUrl: string): Promise<AddToMeetingResult> {
    return { success: true, message: "Mock: bot sent to meeting" };
  }
}
