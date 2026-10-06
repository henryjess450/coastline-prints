import { notFound } from "next/navigation";
import { SendOffPreview } from "./SendOffPreview";

export const metadata = { title: "Send-off preview", robots: { index: false } };

/** DEV ONLY: plays the order send-off with a sample model. 404 in production. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SendOffPreview />;
}
