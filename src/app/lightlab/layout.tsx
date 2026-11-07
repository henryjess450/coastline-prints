import type { Metadata } from "next";
import { ViewTransition } from "react";
import { lightlab } from "@config/lightlab";
import { CardCodeCatcher } from "@/components/lightlab/CardCodeCatcher";
import { CursorGlow } from "@/components/lightlab/CursorGlow";

export const metadata: Metadata = {
  title: { default: lightlab.name, template: `%s · ${lightlab.name}` },
  description: `LightLab is a novelty lamp shop in Victoria, BC, at local markets and online. ${lightlab.partnerLine}.`,
};

export default function LightLabLayout({ children }: { children: React.ReactNode }) {
  // Black and white: see .lightlab-theme in globals.css.
  // Pages cross-fade into each other (browsers with view transitions; others just switch).
  return (
    <div className="lightlab-theme">
      <CursorGlow />
      <CardCodeCatcher />
      <ViewTransition default="ll-page">{children}</ViewTransition>
    </div>
  );
}
