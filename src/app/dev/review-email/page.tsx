import { notFound } from "next/navigation";
import { render } from "@react-email/render";
import { legal } from "@config/site";
import { ReviewRequest } from "@/emails/ReviewRequest";

export const metadata = { title: "Review email preview", robots: { index: false } };

/** DEV ONLY: the "how did your print turn out?" email with sample details. 404 in production. */
export default async function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const html = await render(<ReviewRequest firstName="Sam" orderNumber="CP-1042" shipped={false} reviewUrl="https://g.page/r/example/review" problemDays={legal.problemReportDays} />);
  return <iframe title="Review email" srcDoc={html} className="mx-auto mt-6 block h-[44rem] w-full max-w-2xl rounded-2xl border border-line bg-white" />;
}
