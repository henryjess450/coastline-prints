import { redirect } from "next/navigation";

/** Details are edited right on the account page now; old links land there. */
export default function AccountSettingsPage() {
  redirect("/account#details");
}
