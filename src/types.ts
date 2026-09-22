export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GMAIL_REFRESH_TOKEN_WORK: string;
  GMAIL_REFRESH_TOKEN_PERSONAL: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;
  BRIDGE_SHARED_SECRET: string;
}

export type Source = "gmail" | "wa_business" | "wa_personal";

export interface InboundMessage {
  source: Source;
  account: string;
  externalId: string;
  threadId: string | null;
  sender: string;
  senderName: string | null;
  subject: string | null;
  body: string;
  hasAttachments: boolean;
  receivedAt: number;
}

export interface TriageResult {
  category:
    | "bank"
    | "government"
    | "supplier"
    | "customer"
    | "personal"
    | "noise";
  urgency: "now" | "today" | "this_week" | "whenever" | "none";
  needs_reply: boolean;
  is_bill: boolean;
  summary: string;
  reasoning: string;
}
