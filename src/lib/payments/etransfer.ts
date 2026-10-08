/**
 * Interac e-Transfer helpers shared by the browser and the server (pure).
 */

/** What the browser needs to offer e-Transfer. Null when it isn't set up. */
export type EtransferPublic = { discountPercent: number; payWindowMinutes: number } | null;

/** The e-Transfer discount on what's being paid, rounded to the cent. */
export function etransferDiscount(amountCents: number, percent: number) {
  return Math.max(0, Math.round((amountCents * percent) / 100));
}

/** No 0/O, 1/I/L: easy to read out and type into a banking app. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** "PAY-7K4QX". Different from order numbers (CP-...) so the two can't be confused. */
export function paymentCode(random: (n: number) => number) {
  let s = "";
  for (let i = 0; i < 5; i++) s += ALPHABET[random(ALPHABET.length)];
  return `PAY-${s}`;
}

/** Every payment code in some text, however it was typed ("pay 7k4qx", "PAY-7K4QX."). */
export function findPaymentCodes(text: string) {
  const out = new Set<string>();
  for (const m of text.toUpperCase().matchAll(/PAY[\s\-_:#]*([2-9A-Z]{5})(?![A-Z0-9])/g)) {
    const code = m[1];
    if ([...code].every((c) => ALPHABET.includes(c))) out.add(`PAY-${code}`);
  }
  return [...out];
}

export type InteracDeposit = {
  amountCents: number;
  senderName: string | null;
  memo: string | null;
  reference: string | null;
  /** False for "sent you money" emails that still need to be accepted in the bank. */
  deposited: boolean;
};

/**
 * Reads an Interac e-Transfer notification (subject + plain text). Returns
 * null when it isn't a money-received email or has no amount.
 */
export function parseInteracEmail(subject: string, text: string): InteracDeposit | null {
  const all = `${subject}\n${text}`;
  if (!/e-?transfer/i.test(all)) return null;
  const deposited = /(automatically\s+)?deposited/i.test(all);
  if (!deposited && !/sent you (money|\$)/i.test(all)) return null;

  const amountMatch =
    text.match(/Amount[^$\n]{0,20}\$\s?([\d,]+(?:\.\d{2})?)/i) ?? all.match(/\$\s?([\d,]+\.\d{2})/) ?? all.match(/\$\s?([\d,]+)/);
  if (!amountMatch) return null;
  const amountCents = Math.round(Number(amountMatch[1].replace(/,/g, "")) * 100);
  if (!(amountCents > 0)) return null;

  const line = (label: string) => text.match(new RegExp(`${label}\\s*:?[ \\t]*\\n?[ \\t]*([^\\n]+)`, "i"))?.[1]?.trim() || null;
  const senderName =
    line("Sent From") ?? line("From") ?? subject.match(/:\s*(.+?)\s+(?:sent you|has sent)/i)?.[1]?.trim() ?? all.match(/\n\s*(.+?)\s+sent you/i)?.[1]?.trim() ?? null;
  const memo = line("Message");
  const reference = text.match(/Reference(?:\s+Number)?\s*:?\s*([A-Za-z0-9]{6,})/i)?.[1] ?? null;
  return { amountCents, senderName, memo: memo && !/^\(?none\)?$/i.test(memo) ? memo.slice(0, 500) : null, reference, deposited };
}
