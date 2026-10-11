import type { Metadata } from "next";
import { LightLabHeroText } from "@/components/lightlab/HeroText";
import { HeroIdeas } from "@/components/lightlab/hero/HeroIdeas";

export const metadata: Metadata = { title: "Hero ideas", robots: { index: false, follow: false } };

/** Not linked anywhere: a page for choosing the animation beside the LightLab hero. */
export default function HeroIdeasPage() {
  return <HeroIdeas heroText={<LightLabHeroText />} />;
}
