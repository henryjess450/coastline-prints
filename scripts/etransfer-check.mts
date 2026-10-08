/**
 * Shows what the site reads from the Interac e-Transfer emails in your inbox
 * (last 7 days), without changing anything. Use it after a $1 test transfer.
 *   npx tsx --conditions=react-server scripts/etransfer-check.mts
 * Docker: docker compose exec app npx tsx --conditions=react-server scripts/etransfer-check.mts
 */
import "dotenv/config";

const { etransferSettings, scanInbox } = await import("../src/lib/payments/etransfer.server");
const { parseInteracEmail, findPaymentCodes } = await import("../src/lib/payments/etransfer");

const s = etransferSettings();
if (!s) {
  console.log("e-Transfer isn't set up: fill in ETRANSFER_EMAIL and the ETRANSFER_IMAP_ settings in .env.");
  process.exit(1);
}
console.log(`Reading ${s.user} on ${s.host}...\n`);
let n = 0;
await scanInbox(
  s,
  async (mail) => {
    n++;
    const parsed = parseInteracEmail(mail.subject, mail.text);
    console.log(`— ${mail.receivedAt.toLocaleString("en-CA")}  ${mail.subject}`);
    console.log(`  from: ${mail.fromDomain}   signed by Interac: ${mail.verified ? "yes" : "NO (would need your review)"}`);
    if (!parsed) console.log("  not read as a deposit (if this was one, send this email's text to Claude so the reader can be fixed)");
    else console.log(`  amount: $${(parsed.amountCents / 100).toFixed(2)}   sender: ${parsed.senderName ?? "?"}   deposited: ${parsed.deposited ? "yes" : "no"}\n  message: ${parsed.memo ?? "(none)"}   codes found: ${findPaymentCodes(`${parsed.memo ?? ""} ${mail.subject} ${mail.text}`).join(", ") || "none"}`);
    console.log("");
  },
  { days: 7 },
);
console.log(n ? `${n} Interac email(s) found.` : "No Interac emails in the last 7 days.");
process.exit(0);
