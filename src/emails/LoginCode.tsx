import { Section, Text } from "@react-email/components";
import { colors, EmailLayout, H1, P } from "./components/Layout";

/** The 6-digit sign-in code. */
export function LoginCode({ code, minutes }: { code: string; minutes: number }) {
  return (
    <EmailLayout preview={`Your Coastline Prints sign-in code is ${code}`} footerNote="You're getting this because someone asked to sign in with this email. If it wasn't you, you can ignore it.">
      <H1>Your sign-in code</H1>
      <P muted>Type this code on the Coastline Prints site to sign in.</P>
      <Section style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: "18px 20px", margin: "6px 0 14px", textAlign: "center" }}>
        <Text style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "0.3em", color: colors.brand, fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace" }}>{code}</Text>
      </Section>
      <P muted>It works for {minutes} minutes. Never share it with anyone.</P>
    </EmailLayout>
  );
}
