import type { Metadata } from "next";
import { lightlab } from "@config/lightlab";

export const metadata: Metadata = {
  title: { default: lightlab.name, template: `%s · ${lightlab.name}` },
  description: `LightLab is a novelty lamp shop in Victoria, BC, at local markets and online. ${lightlab.partnerLine}.`,
};

export default function LightLabLayout({ children }: { children: React.ReactNode }) {
  // Black and white: see .lightlab-theme in globals.css.
  return <div className="lightlab-theme">{children}</div>;
}
