"use client";

import { useMemo, useState, useTransition } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { NEIGHBORHOODS } from "@/lib/constants";
import { priceRangeLabel } from "@/lib/constants";
import type { DiscoveryResult } from "@/domain/types";

export function BenefitSearch() {
  const { data } = useDemoSession();
  const { dash } = useAnalyticsDashboard();
  const [query, setQuery] = useState(
    "Onde jantar hoje com o melhor custo-benefício, sem estourar o orçamento?",
  );
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const enriched = useMemo(() => {
    if (!dash || !data) return null;
    return dash.users.find((u) => u.id === data.user.id) ?? dash.users[0] ?? null;
  }, [dash, data]);

  function search() {
    if (!data || !enriched) return;
    setError(null);
    startTransition(async () => {
      try {
        const neighborhood =
          (NEIGHBORHOODS as readonly string[]).includes(
            data.user.preferred_neighborhood,
          )
            ? data.user.preferred_neighborhood
            : NEIGHBORHOODS[0];
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occasion: "rapido",
            neighborhood,
            partySize: 2,
            queryText: query,
            benefitContext: {
              clusterId: enriched.cluster,
              clusterLabel: enriched.clusterLabel,
              benefitType: enriched.benefitType,
              benefitValueBrl: enriched.benefitValueBrl,
              giftbackBalanceBrl: enriched.giftbackBalanceBrl || enriched.benefitValueBrl,
              avgTicketBrl: Number(data.user.user_avg_ticket_brl),
              minTicketBrl: enriched.minTicketBrl,
              freeDishName: enriched.freeDishName ?? undefined,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Falha na busca");
          return;
        }
        setResult(json as DiscoveryResult);
      } catch {
        setError("Falha de rede");
      }
    });
  }

  if (!data) return null;

  return (
    <section className="if-card space-y-3 p-4 sm:p-5">
      <div>
        <h2 className="font-title text-lg font-extrabold">
          Pergunte onde jantar
        </h2>
        <p className="mt-1 text-xs text-muted">
          A busca já considera seu cupom, giftback ou prato grátis
          {enriched?.minTicketBrl
            ? ` · libera com gastos acima de R$ ${enriched.minTicketBrl.toFixed(0)}`
            : ""}
        </p>
      </div>
      <textarea
        className="w-full rounded-if border border-[var(--ifdl-color-border)] px-3 py-2 text-sm"
        rows={2}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        type="button"
        className="if-btn-primary"
        disabled={pending || !enriched}
        onClick={search}
      >
        {pending ? "Buscando…" : "Buscar lugares"}
      </button>
      {error && <p className="text-sm font-semibold text-ifood">{error}</p>}
      {result && (
        <ul className="space-y-2">
          {result.items.map((item) => (
            <li
              key={item.restaurant.id}
              className="rounded-if bg-page px-3 py-2 text-sm"
            >
              <span className="font-extrabold">
                #{item.rank} {item.restaurant.name}
              </span>
              <span className="text-muted">
                {" "}
                · {item.reason_label} ·{" "}
                {priceRangeLabel(item.restaurant.price_range)}
              </span>
              {result.isFallback && (
                <span className="ml-2 text-[10px] font-bold uppercase text-muted">
                  fallback
                </span>
              )}
            </li>
          ))}
          {!result.items.length && (
            <li className="text-sm text-muted">Nenhum restaurante elegível.</li>
          )}
        </ul>
      )}
    </section>
  );
}
