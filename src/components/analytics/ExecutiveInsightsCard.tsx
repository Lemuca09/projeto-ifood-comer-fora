"use client";

import { useMemo, useState, useTransition } from "react";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { executiveBriefLocal } from "@/lib/executiveBriefLocal";

type Brief = {
  headline: string;
  lucroReal: string;
  canibalizacao: string;
  proximoPasso: string;
  isFallback: boolean;
  fallbackReason?: string;
};

const FALLBACK_HINT: Record<string, string> = {
  claude_credits:
    "Conta Anthropic sem créditos. Adicione saldo em Plans & Billing e tente de novo.",
  claude_auth:
    "Claude não autenticou. Confira API_KEY_CLAUDE (padrão sk-ant-usr-) no .env e reinicie o servidor.",
  claude_empty_or_auth:
    "Claude não autenticou. Confira API_KEY_CLAUDE (padrão sk-ant-usr-) no .env e reinicie o servidor.",
  claude_timeout: "Claude demorou demais. Tente de novo.",
  claude_parse: "Claude respondeu, mas o JSON veio inválido. Tente de novo.",
  budget: "Limite de uso de IA atingido. Aguarde um minuto e tente de novo.",
  global_daily: "Limite diário de IA atingido.",
  session_minute: "Muitas gerações seguidas. Aguarde um minuto.",
  session_total: "Limite da sessão de IA atingido.",
  ip_minute: "Muitas gerações neste IP. Aguarde um minuto.",
  ai_disabled: "IA desligada ou sem chave. Ative AI_ENABLED e API_KEY_CLAUDE.",
};

export function ExecutiveInsightsCard() {
  const { dash } = useAnalyticsDashboard();
  const local = useMemo(
    () => (dash ? executiveBriefLocal(dash) : null),
    [dash],
  );
  const [brief, setBrief] = useState<Brief | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = brief ?? local;

  function generateWithAi() {
    if (!dash) return;
    setHint(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/analytics/gemini/executive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seed: dash.seed, useAi: true }),
        });
        const j = (await res.json()) as Brief & { error?: string };
        if (!res.ok) {
          setHint(j.error ?? "Falha ao gerar com Claude.");
          return;
        }
        setBrief(j);
        if (j.isFallback) {
          const reason = j.fallbackReason ?? "claude_empty_or_auth";
          setHint(
            FALLBACK_HINT[reason] ??
              `Geração caiu no modo local (${reason}).`,
          );
        } else {
          setHint(null);
        }
      } catch {
        setHint("Sem conexão com a API. Verifique se o servidor está no ar.");
      }
    });
  }

  if (!shown) return null;

  return (
    <section className="overflow-hidden rounded-if-lg border border-ifood/20 bg-gradient-to-br from-ifood-soft via-white to-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-title text-lg font-extrabold text-ink">
          Leitura rápida
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
            {shown.isFallback ? "Local (0 RPM)" : "Claude"}
          </span>
          <button
            type="button"
            className="rounded-if border border-ifood/30 bg-white px-2.5 py-1 text-[11px] font-extrabold text-ifood disabled:opacity-50"
            disabled={pending || !dash}
            onClick={generateWithAi}
          >
            {pending ? "Gerando…" : "Gerar com Claude"}
          </button>
        </div>
      </div>
      {hint ? (
        <p className="mt-2 rounded-if border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
          {hint}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        <p className="font-title text-base font-extrabold text-ifood">
          {shown.headline}
        </p>
        <p className="text-sm text-ink">
          <span className="font-bold">Lucro real:</span> {shown.lucroReal}
        </p>
        <p className="text-sm text-ink">
          <span className="font-bold">Canibalização:</span> {shown.canibalizacao}
        </p>
        <p className="text-sm text-muted">
          <span className="font-bold text-ink">Próximo passo:</span>{" "}
          {shown.proximoPasso}
        </p>
      </div>
    </section>
  );
}
