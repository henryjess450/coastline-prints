"use client";
import { createContext, useContext } from "react";
import type { AppConfig } from "@/lib/config/types";

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({ config, children }: { config: AppConfig; children: React.ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const cfg = useContext(ConfigContext);
  if (!cfg) throw new Error("useConfig must be used inside <ConfigProvider>");
  return cfg;
}
