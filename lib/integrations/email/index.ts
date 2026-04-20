import type { IEmailService } from "./IEmailService";
import { ResendEmailService } from "./resend";

let instance: IEmailService | null = null;

export function getEmailService(): IEmailService {
  if (!instance) instance = new ResendEmailService();
  return instance;
}
