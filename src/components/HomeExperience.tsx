"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { DiagnosisPanel } from "@/components/DiagnosisPanel";
import { ARCHETYPE_LABELS, type Archetype } from "@/domain/personas";
import { brl } from "@/components/analytics/format";
import { benefitCopy } from "@/lib/benefitCopy";

export function HomeExperience() {
  const { data, loading, recalculating, error, bootstrap } = useDemoSession();
  const { dash } = useAnalyticsDashboard();

  const activeBenefit = useMemo(() => {
    if (!dash || !data) return null;
    return (
      dash.users.find((u) => u.id === data.user.id) ?? dash.users[0] ?? null
    );
  }, [dash, data]);

  const benefitUi = activeBenefit
    ? benefitCopy(activeBenefit)
    : {
        title: "Seu benefício",
        detail: "Carregando…",
        minSpendLine: null as string | null,
      };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-if-lg bg-neutral-200" />
        <div className="h-40 animate-pulse rounded-if-lg bg-neutral-100" />
        <p className="text-center text-sm text-muted">Montando sessão…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="if-card space-y-3 p-6 text-center">
        <p className="font-title text-lg font-extrabold">Não foi possível carregar</p>
        <p className="text-sm text-muted">{error}</p>
        <p className="text-xs text-muted">
          Confirme migration 006 + <code>npm run seed:personas</code>.
        </p>
        <button type="button" className="if-btn-primary" onClick={() => void bootstrap()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {recalculating && (
        <div className="rounded-if border border-ifood/20 bg-ifood-soft px-3 py-2 text-sm font-semibold text-ifood">
          Atualizando contexto…
        </div>
      )}

      <section className="overflow-hidden rounded-if-lg bg-gradient-to-r from-ifood to-ifood-dark px-6 py-7 text-white shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          iFood pra comer fora · sessão sintética
        </p>
        <h1 className="font-title mt-2 text-3xl font-extrabold sm:text-4xl">
          Escolha onde comer fora agora
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/90">
          Para <strong>{data.user.display_name}</strong> (
          {ARCHETYPE_LABELS[data.user.archetype as Archetype]})
          {activeBenefit ? ` · ${activeBenefit.clusterLabel}` : ""}. O
          diagnóstico orienta a jornada; reservas e busca ficam na{" "}
          <Link href="/cliente" className="underline decoration-white/60 underline-offset-2">
            aba Cliente
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white px-3 py-1 text-ifood">
            {benefitUi.title}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1">
            Ticket médio {brl(Number(data.user.user_avg_ticket_brl))}
          </span>
          {benefitUi.minSpendLine && (
            <span className="rounded-full bg-white/20 px-3 py-1">
              {benefitUi.minSpendLine}
            </span>
          )}
          <span className="rounded-full bg-white/20 px-3 py-1">
            Fadiga {data.diagnosis.fatigue_risk_pct}%
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1">
            Economia est. {brl(data.diagnosis.financial_advantage_brl)}
          </span>
        </div>
      </section>

      <DiagnosisPanel data={data} />

      <p className="text-center text-sm">
        <Link href="/metricas" className="font-bold text-ifood">
          Ver painel analítico →
        </Link>
      </p>
    </div>
  );
}
