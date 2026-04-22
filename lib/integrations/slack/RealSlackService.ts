import { WebClient } from "@slack/web-api";
import type { ISlackService, SlackUser, SendDMResult } from "./ISlackService";

export class RealSlackService implements ISlackService {
  private client: WebClient;

  constructor() {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
    this.client = new WebClient(token);
  }

  async lookupUserByEmail(email: string): Promise<SlackUser | null> {
    try {
      const res = await this.client.users.lookupByEmail({ email });
      if (!res.ok || !res.user?.id) return null;
      return {
        id:       res.user.id,
        email:    res.user.profile?.email ?? email,
        realName: res.user.profile?.real_name ?? res.user.name ?? "",
      };
    } catch (err) {
      const data = (err as { data?: { error?: string } }).data;
      // `users_not_found` is the expected "not in workspace yet" response.
      if (data?.error === "users_not_found") return null;
      throw err;
    }
  }

  async sendDM(userId: string, text: string): Promise<SendDMResult> {
    const dm = await this.client.conversations.open({ users: userId });
    if (!dm.ok || !dm.channel?.id) {
      return { ok: false, reason: dm.error ?? "conversations.open failed" };
    }
    const channelId = dm.channel.id;
    const msg = await this.client.chat.postMessage({ channel: channelId, text });
    return msg.ok
      ? { ok: true, channelId }
      : { ok: false, channelId, reason: msg.error ?? "chat.postMessage failed" };
  }

  async postChannelMessage(channelId: string, text: string): Promise<SendDMResult> {
    const msg = await this.client.chat.postMessage({ channel: channelId, text });
    return msg.ok
      ? { ok: true, channelId }
      : { ok: false, channelId, reason: msg.error ?? "chat.postMessage failed" };
  }
}
