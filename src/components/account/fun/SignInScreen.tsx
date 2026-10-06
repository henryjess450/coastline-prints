"use client";
import { useState } from "react";
import { SignIn } from "@/components/account/SignIn";
import { Card } from "@/components/ui/Card";
import { AccountBuddy, type BuddyState } from "./AccountBuddy";

/** The signed-out account page: the account buddy watching over the sign-in form. */
export function SignInScreen({ intro }: { intro: string }) {
  const [state, setState] = useState<BuddyState>({ mood: "idle" });
  return (
    <>
      <div className="mb-10 text-center">
        <AccountBuddy state={state} />
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">Your account</h1>
      </div>
      <Card flat className="p-6 sm:p-10">
        <SignIn intro={intro} onState={setState} />
      </Card>
    </>
  );
}
