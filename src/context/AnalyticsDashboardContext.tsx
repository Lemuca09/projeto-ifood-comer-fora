"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DashboardPayload } from "@/services/analyticsEngine";

type AnalyticsState = {
  loading: boolean;
  regenerating: boolean;
  error: string | null;
  dash: DashboardPayload | null;
  regenerate: () => Promise<void>;
  refresh: (seed?: number) => Promise<void>;
};

const Ctx = createContext<AnalyticsState | null>(null);

const SEED_KEY = "cf_analytics_seed";

function readSeed(): number {
  if (typeof window === "undefined") return 42;
  const raw = sessionStorage.getItem(SEED_KEY);
  if (raw && !Number.isNaN(Number(raw))) return Number(raw);
  const seed = Date.now() % 1_000_000;
  sessionStorage.setItem(SEED_KEY, String(seed));
  return seed;
}

export function AnalyticsDashboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dash, setDash] = useState<DashboardPayload | null>(null);

  const refresh = useCallback(async (seedArg?: number) => {
    const seed = seedArg ?? readSeed();
    sessionStorage.setItem(SEED_KEY, String(seed));
    setError(null);
    try {
      const res = await fetch(`/api/analytics/dashboard?seed=${seed}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha no dashboard");
      setDash(json as DashboardPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setDash(null);
    }
  }, []);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    setError(null);
    try {
      const seed = Date.now() % 1_000_000;
      sessionStorage.setItem(SEED_KEY, String(seed));
      const res = await fetch("/api/analytics/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao regenerar");
      setDash(json as DashboardPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRegenerating(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo(
    () => ({ loading, regenerating, error, dash, regenerate, refresh }),
    [loading, regenerating, error, dash, regenerate, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalyticsDashboard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalyticsDashboard fora do provider");
  return ctx;
}
