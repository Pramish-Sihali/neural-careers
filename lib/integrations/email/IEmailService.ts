export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface IEmailService {
  send(options: SendEmailOptions): Promise<{ id: string }>;
}
