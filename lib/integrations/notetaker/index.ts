// lib/integrations/notetaker/index.ts

import type { INotetakerService } from "./INotetakerService";
import { MockNotetakerService } from "./MockNotetakerService";
import { FirefliesNotetakerService } from "./FirefliesNotetakerService";

export function getNotetakerService(): INotetakerService {
  if (process.env.USE_MOCK_NOTETAKER === "true") {
    return new MockNotetakerService();
  }
  return new FirefliesNotetakerService();
}

export type { INotetakerService, FirefliesTranscript, NotetakerContext } from "./INotetakerService";
