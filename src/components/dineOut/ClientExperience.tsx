"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import {
  buildClientHistory,
  buildClientRecommendations,
} from "@/domain/dineOut/clientView";

export function ClientExperience() {
  const { data, loading } = useDemoSession();
  const { dash } = useAnalyticsDashboard();

  const enriched = useMemo(() => {
    if (!dash || !data) return null;
    return dash.users.find((u) => u.id === data.user.id) ?? dash.users[0] ?? null;
  }, [dash, data]);

  const recos = useMemo(() => {
    if (!dash || !enriched) return [];
    return buildClientRecommendations(dash, enriched);
  }, [dash, enriched]);

  const history = useMemo(() => {
    if (!dash || !enriched) return [];
    return buildClientHistory(dash, enriched);
  }, [dash, enriched]);

  if (loading || !data) {
    return (
      <div className="h-40 animate-pulse rounded-if-lg bg-neutral-200" />
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-if-lg bg-gradient-to-br from-[#1a1a1a] via-[#2b2b2b] to-ifood px-5 py-7 text-white shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-white/70">
          O que o cliente iFood vê
        </p>
        <h1 className="font-title mt-2 text-3xl font-extrabold">
          Para você, {data.user.display_name.split(" ").slice(-1)[0]}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/85">
          Sugestões com maior chance de visita e histórico com reativação quando
          a recorrência cai — benefícios claros em cada card.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-title text-xl font-extrabold">
            Recomendações personalizadas
          </h2>
          <p className="text-xs text-muted">
            Probabilidade de visita · benefícios aplicáveis no local
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {recos.map((r) => (
            <li key={r.restaurantId} className="if-card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-title text-base font-extrabold">{r.name}</h3>
                  <p className="text-xs text-muted">{r.neighborhood}</p>
                </div>
                <span className="rounded-full bg-ifood-soft px-2.5 py-1 text-[11px] font-extrabold text-ifood">
                  {r.visitProbabilityPct}% visita
                </span>
              </div>
              <div className="mt-3 rounded-if bg-ifood-soft/80 px-3 py-2">
                <p className="text-xs font-extrabold text-ifood">{r.benefitTitle}</p>
                <p className="text-[11px] font-semibold text-muted">
                  {r.benefitDetail}
                </p>
              </div>
              <Link href="/" className="if-btn-primary mt-3 w-full text-center">
                Ver no mapa Pra Hoje
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-title text-xl font-extrabold">
            Histórico e retenção
          </h2>
          <p className="text-xs text-muted">
            Anti-churn: benefícios exclusivos quando a recorrência cai
          </p>
        </div>
        <ul className="space-y-3">
          {history.map((h) => (
            <li
              key={h.restaurantId}
              className={`if-card p-4 ${
                h.losingInterest ? "border-amber-200/80" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-title text-base font-extrabold">{h.name}</h3>
                  <p className="text-xs text-muted">
                    {h.neighborhood} · última visita há {h.lastVisitDaysAgo}{" "}
                    dias · {h.visits90d} visitas / 90d
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {h.isFavorite && (
                    <span className="rounded-full bg-ifood-soft px-2.5 py-1 text-[10px] font-extrabold uppercase text-ifood">
                      Favorito
                    </span>
                  )}
                  {h.losingInterest && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-amber-800">
                      Perdendo interesse
                    </span>
                  )}
                </div>
              </div>
              {h.winbackTitle && (
                <div className="mt-3 rounded-if border border-dashed border-ifood/30 bg-ifood-soft/50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-ifood">
                    Benefício de reativação
                  </p>
                  <p className="text-sm font-extrabold text-ink">{h.winbackTitle}</p>
                  <p className="text-[11px] text-muted">{h.winbackDetail}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
