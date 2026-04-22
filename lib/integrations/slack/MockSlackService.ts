import type { ISlackService, SlackUser, SendDMResult } from "./ISlackService";

/**
 * Deterministic mock. Returns a fake user for every email EXCEPT the marker
 * "not-in-slack@example.com", which returns null to simulate "user has not
 * joined the workspace yet". Records the last DM/channel message so tests can
 * assert on payload.
 */
export class MockSlackService implements ISlackService {
  lastDM: { userId: string; text: string } | null = null;
  lastChannelMessage: { channelId: string; text: string } | null = null;

  async lookupUserByEmail(email: string): Promise<SlackUser | null> {
    if (email === "not-in-slack@example.com") return null;
    return {
      id:       `U${hashToAlphanumeric(email).slice(0, 10).toUpperCase()}`,
      email,
      realName: email.split("@")[0],
    };
  }

  async sendDM(userId: string, text: string): Promise<SendDMResult> {
    this.lastDM = { userId, text };
    return { ok: true, channelId: `D${userId.slice(1)}` };
  }

  async postChannelMessage(channelId: string, text: string): Promise<SendDMResult> {
    this.lastChannelMessage = { channelId, text };
    return { ok: true, channelId };
  }
}

function hashToAlphanumeric(s: string): string {
  let hash = 0;
  for (const ch of s) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}
