import { Resend } from "resend";
import type { IEmailService, SendEmailOptions } from "./IEmailService";

export class ResendEmailService implements IEmailService {
  private client: Resend;
  private defaultFrom: string;

  constructor() {
    this.client = new Resend(process.env.RESEND_API_KEY!);
    this.defaultFrom = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  }

  async send(options: SendEmailOptions): Promise<{ id: string }> {
    const { data, error } = await this.client.emails.send({
      from: options.from ?? this.defaultFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) throw new Error(`Resend error: ${error.message}`);
    if (!data?.id) throw new Error("Resend returned no message ID");

    return { id: data.id };
  }
}
