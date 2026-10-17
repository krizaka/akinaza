/** What the mail module needs, as plain values — it never reads the environment itself. */
export interface MailSettings {
  provider: "mailgun" | "none";
  apiKey?: string;
  domain?: string;
  from?: string;
  apiUrl: string;
  /** The public origin used in the links of a mail. */
  appUrl: string;
}
