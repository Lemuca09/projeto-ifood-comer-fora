"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DemoBootstrapResult } from "@/services/demoSession";
import type { DemoSessionMetrics } from "@/domain/personas";

type DemoState = {
  loading: boolean;
  recalculating: boolean;
  error: string | null;
  data: DemoBootstrapResult | null;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  bootstrap: () => Promise<void>;
  recalculate: (input: {
    syntheticUserId: string;
    metrics: DemoSessionMetrics;
    user_push_ignored_streak?: number;
    user_fatigue_score?: number;
  }) => Promise<void>;
};

const Ctx = createContext<DemoState | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DemoBootstrapResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/bootstrap", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha no bootstrap");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const recalculate = useCallback(
    async (input: {
      syntheticUserId: string;
      metrics: DemoSessionMetrics;
      user_push_ignored_streak?: number;
      user_fatigue_score?: number;
    }) => {
      setRecalculating(true);
      setError(null);
      try {
        const res = await fetch("/api/demo/recalculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Falha ao recalcular");
        setData(json);
        setDrawerOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        setRecalculating(false);
      }
    },
    [],
  );

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const value = useMemo(
    () => ({
      loading,
      recalculating,
      error,
      data,
      drawerOpen,
      setDrawerOpen,
      bootstrap,
      recalculate,
    }),
    [loading, recalculating, error, data, drawerOpen, bootstrap, recalculate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemoSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemoSession fora do provider");
  return ctx;
}
