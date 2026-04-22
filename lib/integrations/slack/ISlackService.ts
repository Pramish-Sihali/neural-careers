// lib/integrations/slack/ISlackService.ts

export interface SlackUser {
  id:       string;
  email:    string;
  realName: string;
}

export interface SendDMResult {
  ok:        boolean;
  channelId?: string;
  reason?:   string;
}

export interface ISlackService {
  /**
   * Resolve a Slack user by email. Returns null if user has not yet joined
   * the workspace. Callers must tolerate null without treating it as an error.
   */
  lookupUserByEmail(email: string): Promise<SlackUser | null>;

  /**
   * Open a DM channel with the user and send a message. Idempotency is the
   * caller's responsibility — Slack itself will happily deliver duplicates.
   */
  sendDM(userId: string, text: string): Promise<SendDMResult>;

  /**
   * Post a message to a channel the bot is a member of. Used for HR notifications.
   */
  postChannelMessage(channelId: string, text: string): Promise<SendDMResult>;
}
