import { colors, EmailLayout, H1, P, PillButton } from "./components/Layout";
import { Text } from "@react-email/components";

/** The owner set up an account for them: how to sign in, and what it's for. */
export function AccountInvite({ name, signInUrl, note }: { name: string | null; signInUrl: string; note?: string | null }) {
  return (
    <EmailLayout preview="Your Coastline Prints account is ready" footerNote="You're getting this because Coastline Prints set up an account with this email. If that's not right, you can ignore it.">
      <H1>{name ? `Hi ${name.split(/\s+/)[0]}, your account is ready` : "Your account is ready"}</H1>
      {note && <P>{note}</P>}
      <P>Coastline Prints set up an account for you. Sign in with this email (we send a code, no password) to see your orders, collect reward points, and save gift cards and coupons.</P>
      <PillButton href={signInUrl}>Sign in</PillButton>
      <Text style={{ margin: "18px 0 0", fontSize: 13, color: colors.faint }}>Or go to {signInUrl.replace(/^https?:\/\//, "")}</Text>
    </EmailLayout>
  );
}
