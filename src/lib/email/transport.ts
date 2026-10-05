import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { site } from "@config/site";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string; replyTo?: string };

export interface Mailer {
  readonly mode: "gmail" | "smtp" | "preview";
  send(email: OutgoingEmail, id: string): Promise<void>;
}

/** Thrown for problems retrying won't fix (e.g. the address doesn't exist). */
export class PermanentEmailError extends Error {}

/**
 * Picks how mail is sent:
 * - Gmail: GMAIL_USER + GMAIL_APP_PASSWORD (an App Password, not your normal password).
 * - Any SMTP server: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.
 * - Neither, outside production: "preview" mode writes each email to
 *   storage/email-previews/ so you can open it in a browser.
 *
 * Outside production, preview mode is ALWAYS used (even with Gmail set up)
 * so test orders never email anyone. Set EMAIL_SEND_IN_DEV="true" to send
 * real email while developing.
 */
export function getMailer(): Mailer {
  if (process.env.NODE_ENV !== "production" && process.env.EMAIL_SEND_IN_DEV !== "true") return previewMailer();
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (gmailUser && gmailPass) {
    return smtpMailer("gmail", nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass } }), process.env.EMAIL_FROM ?? `"${site.name}" <${gmailUser}>`);
  }
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    });
    return smtpMailer("smtp", transport, process.env.EMAIL_FROM ?? `"${site.name}" <${process.env.SMTP_USER}>`);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.");
  }
  return previewMailer();
}

function smtpMailer(mode: "gmail" | "smtp", transport: Transporter, from: string): Mailer {
  return {
    mode,
    async send(email) {
      try {
        await transport.sendMail({ from, to: email.to, replyTo: email.replyTo, subject: email.subject, html: email.html, text: email.text });
      } catch (err) {
        const code = (err as { responseCode?: number }).responseCode;
        // 550/553 etc: mailbox doesn't exist or address rejected. Retrying won't help.
        if (code && code >= 550 && code < 560) throw new PermanentEmailError((err as Error).message);
        throw err;
      }
    },
  };
}

function previewMailer(): Mailer {
  return {
    mode: "preview",
    async send(email, id) {
      const dir = path.resolve(process.env.STORAGE_DIR ?? "./storage", "email-previews");
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}.html`);
      const banner = `<div style="font:13px monospace;background:#fff3c4;padding:8px 12px;border-bottom:1px solid #e0c060">PREVIEW (not sent) · To: ${escape(email.to)} · Subject: ${escape(email.subject)}</div>`;
      await writeFile(file, banner + email.html);
      console.info(`[email:preview] "${email.subject}" to ${email.to} → ${file}`);
    },
  };
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
