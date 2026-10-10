"use client";
import { createContext, useContext } from "react";
import { seasons, type Season } from "@config/seasons";

const SeasonContext = createContext<Season>(seasons[0]);

/** The site theme, for decor in client components (the header's logo topper and trim). */
export function SeasonProvider({ season, children }: { season: Season; children: React.ReactNode }) {
  return <SeasonContext.Provider value={season}>{children}</SeasonContext.Provider>;
}

export const useSeason = () => useContext(SeasonContext);
