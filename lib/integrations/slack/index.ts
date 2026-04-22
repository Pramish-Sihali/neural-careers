import type { ISlackService } from "./ISlackService";
import { MockSlackService } from "./MockSlackService";
import { RealSlackService } from "./RealSlackService";

let cached: ISlackService | null = null;

export function getSlackService(): ISlackService {
  if (cached) return cached;
  cached = process.env.USE_MOCK_SLACK === "true"
    ? new MockSlackService()
    : new RealSlackService();
  return cached;
}

/** Test-only helper — allows test teardown to reset singleton state. */
export function __resetSlackServiceForTests(): void {
  cached = null;
}

export type { ISlackService, SlackUser, SendDMResult } from "./ISlackService";
