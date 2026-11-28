"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { NEIGHBORHOODS, priceRangeLabel } from "@/lib/constants";
import { formatSlotLocal, partySizeFromMode } from "@/lib/dineTime";
import {
  readConciergeMemory,
  writeConciergeMemory,
} from "@/lib/conciergeMemory";
import type { DiscoveryResult } from "@/domain/types";
import type { PartySizeMode } from "@/domain/personas";

const DEFAULT_QUERY =
  "Onde jantar hoje com o melhor custo-benefício, sem estourar o orçamento?";

export function BenefitSearch() {
  const { data } = useDemoSession();
  const { dash } = useAnalyticsDashboard();
  const userId = data?.user.id ?? "";

  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Restaura resposta ao voltar para /cliente (cache em memória; some no reload).
  useEffect(() => {
    if (!userId) return;
    const cached = readConciergeMemory(userId);
    if (!cached) return;
    setQuery(cached.query);
    setResult(cached.result);
  }, [userId]);

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
        const partySizeMode = (data.user.party_size_mode ??
          "2") as PartySizeMode;
        const partySize = partySizeFromMode(partySizeMode);
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occasion: "rapido",
            neighborhood,
            partySize,
            queryText: query,
            conversational: true,
            userProfile: {
              displayName: data.user.display_name,
              preferredCuisine: data.user.preferred_cuisine,
              preferredHourSlot: data.user.preferred_hour_slot,
              priceSensitivity: Number(data.user.price_sensitivity ?? 0.5),
              partySizeMode,
              favoriteRestaurantId: data.user.favorite_restaurant_id,
              comerForaVisits90d: data.user.comer_fora_visits_90d,
              daysSinceLastDinein: data.user.user_days_since_last_dinein,
            },
            benefitContext: {
              clusterId: enriched.cluster,
              clusterLabel: enriched.clusterLabel,
              benefitType: enriched.benefitType,
              benefitValueBrl: enriched.benefitValueBrl,
              giftbackBalanceBrl:
                enriched.giftbackBalanceBrl || enriched.benefitValueBrl,
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
        const next = json as DiscoveryResult;
        setResult(next);
        writeConciergeMemory(data.user.id, query, next);
      } catch {
        setError("Falha de rede");
      }
    });
  }

  if (!data) return null;

  return (
    <section id="concierge" className="if-card scroll-mt-24 space-y-3 p-4 sm:p-5">
      <div>
        <h2 className="font-title text-lg font-extrabold">
          Pergunte onde jantar
        </h2>
        <p className="mt-1 text-xs text-muted">
          Sugestões com mesas livres e benefícios reais da sua conta
          {enriched?.minTicketBrl
            ? ` · libera com gastos acima de R$ ${enriched.minTicketBrl.toFixed(0)}`
            : ""}
          {data.user.preferred_cuisine
            ? ` · culinária favorita: ${data.user.preferred_cuisine}`
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
        {pending ? "Buscando sugestões…" : "Buscar lugares"}
      </button>
      {error && <p className="text-sm font-semibold text-ifood">{error}</p>}
      {result && (
        <div className="space-y-3">
          {result.answer && (
            <div
              className={
                result.blocked
                  ? "rounded-if border border-amber-200 bg-amber-50 px-3 py-3"
                  : "rounded-if border border-ifood/15 bg-ifood-soft/40 px-3 py-3"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={
                    result.blocked
                      ? "text-[10px] font-bold uppercase tracking-wide text-amber-800"
                      : "text-[10px] font-bold uppercase tracking-wide text-ifood"
                  }
                >
                  {result.blocked
                    ? "Pedido não atendido"
                    : "Concierge Comer Fora"}
                </p>
                {!result.blocked && (
                  <p className="text-[10px] font-semibold text-muted">
                    {result.intentLabel
                      ? `Intenção: ${result.intentLabel}`
                      : ""}
                    {result.answerIsFallback === false
                      ? `${result.intentLabel ? " · " : ""}Claude`
                      : result.aiFailReason
                        ? `${result.intentLabel ? " · " : ""}Local (fallback Claude) · ${result.aiFailReason}`
                        : ""}
                  </p>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                {result.answer}
              </p>
            </div>
          )}
          {!result.blocked && (
            <ul className="space-y-2">
              {result.items.map((item) => {
                const slots =
                  item.available_slots?.map(formatSlotLocal) ??
                  (item.next_slot
                    ? [formatSlotLocal(item.next_slot.starts_at)]
                    : []);
                return (
                  <li key={item.restaurant.id}>
                    <Link
                      href={`/cliente/restaurante/${item.restaurant.id}`}
                      className="block rounded-if bg-page px-3 py-2.5 text-sm transition hover:border-ifood/30 hover:bg-ifood-soft/30"
                    >
                      <span className="font-extrabold">
                        #{item.rank} {item.restaurant.name}
                      </span>
                      <span className="text-muted">
                        {" "}
                        · {item.cuisine ?? item.reason_label} ·{" "}
                        {priceRangeLabel(item.restaurant.price_range)}
                      </span>
                      {slots.length > 0 && (
                        <p className="mt-1 text-[11px] font-semibold text-[var(--ifdl-color-success)]">
                          Mesas livres: {slots.join(" · ")}
                        </p>
                      )}
                      {typeof item.promo_discount_pct === "number" &&
                        item.promo_discount_pct > 0 && (
                          <p className="text-[11px] font-semibold text-ifood">
                            {item.promo_discount_pct}% de desconto no salão
                          </p>
                        )}
                    </Link>
                  </li>
                );
              })}
              {!result.items.length && (
                <li className="text-sm text-muted">
                  Nenhum restaurante com mesa livre neste momento.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
