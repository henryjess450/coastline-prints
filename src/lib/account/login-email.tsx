import "server-only";
import { render, toPlainText } from "@react-email/render";
import { LoginCode } from "@/emails/LoginCode";
import { getMailer } from "@/lib/email/transport";
import { CODE_MINUTES } from "./auth";

/** Sends the sign-in code straight away (not queued, so it's never stored in plain text). */
export async function sendLoginCode(email: string, code: string) {
  const html = await render(<LoginCode code={code} minutes={CODE_MINUTES} />);
  await getMailer().send({ to: email, subject: `Your Coastline Prints sign-in code: ${code}`, html, text: toPlainText(html) }, `login-${new Date().getTime()}`);
}
