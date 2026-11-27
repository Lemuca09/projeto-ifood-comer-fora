"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { buildClientHistoryFromCatalog } from "@/domain/dineOut/clientView";
import { benefitCopy } from "@/lib/benefitCopy";
import { priceRangeLabel } from "@/lib/constants";
import type { CatalogRestaurant } from "@/services/restaurants";

const COVER = [
  "from-[#ff6b35] to-[#ea1d2c]",
  "from-[#f7b733] to-[#fc4a1a]",
  "from-[#00b09b] to-[#96c93d]",
];

export function ClientExperience() {
  const { data, loading } = useDemoSession();
  const { dash } = useAnalyticsDashboard();
  const [catalog, setCatalog] = useState<CatalogRestaurant[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const enriched = useMemo(() => {
    if (!dash || !data) return null;
    return dash.users.find((u) => u.id === data.user.id) ?? dash.users[0] ?? null;
  }, [dash, data]);

  const benefitUi = enriched
    ? benefitCopy(enriched)
    : {
        title: "Benefício no salão",
        detail: "Abra o restaurante para ver Delivery e Comer Fora",
        minSpendLine: null as string | null,
      };

  const prefersQuietBenefits = data?.user.archetype === "push_averse";

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);

    const neighborhood = encodeURIComponent(data.user.preferred_neighborhood);
    void fetch(`/api/restaurants?neighborhood=${neighborhood}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Falha ao carregar restaurantes");
        }
        if (!cancelled) setCatalog(json.restaurants as CatalogRestaurant[]);
      })
      .catch((e) => {
        if (!cancelled) {
          setCatalogError(e instanceof Error ? e.message : "Erro");
          setCatalog([]);
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  /** Só restaurantes vindos do banco (bootstrap + catálogo do bairro). */
  const recommendations = useMemo(() => {
    if (!data) return [];
    if (data.recommendations.length > 0) return data.recommendations;

    return catalog.slice(0, 8).map((r, idx) => ({
      rank: idx + 1,
      reason_code: "NEARBY",
      reason_label: "Perto do bairro pedido",
      score: 70 - idx * 3,
      restaurant: r,
    }));
  }, [data, catalog]);

  const history = useMemo(() => {
    if (!enriched) return [];
    const pool =
      catalog.length > 0
        ? catalog
        : recommendations.map((r) => r.restaurant);
    return buildClientHistoryFromCatalog(pool, enriched);
  }, [catalog, enriched, recommendations]);

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
          Abra um restaurante para ver Delivery e Comer Fora no mesmo lugar —
          reserve a mesa sem passar pelo perfil.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-title text-xl font-extrabold">
            Recomendações personalizadas
          </h2>
          <p className="text-xs text-muted">
            Catálogo do banco · {data.user.preferred_neighborhood} · mesmos
            cards do Início
          </p>
        </div>

        {catalogError && (
          <p className="rounded-if border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            {catalogError}. Usando sugestões da sessão quando disponíveis.
          </p>
        )}

        {catalogLoading && recommendations.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="if-card h-56 animate-pulse bg-neutral-100"
              />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <p className="if-card p-4 text-sm text-muted">
            Nenhum restaurante no banco para este bairro. Confirme o seed do
            catálogo.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((item, idx) => (
              <li key={item.restaurant.id}>
                <Link
                  href={`/cliente/restaurante/${item.restaurant.id}`}
                  className="if-card flex h-full flex-col transition hover:border-ifood/40"
                >
                  <div
                    className={`relative h-32 bg-gradient-to-br sm:h-36 ${COVER[idx % COVER.length]}`}
                  >
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ifood shadow-sm">
                      #{item.rank} · {item.reason_label}
                    </span>
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-1 text-[11px] font-bold text-white">
                      {priceRangeLabel(item.restaurant.price_range)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col space-y-2 p-4">
                    <div className="flex-1">
                      <h3 className="font-title text-lg font-extrabold">
                        {item.restaurant.name}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                        {item.restaurant.description}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-muted">
                        {item.restaurant.neighborhood} · score{" "}
                        {item.score.toFixed(0)}
                      </p>
                      {typeof item.restaurant.typical_wait_min === "number" && (
                        <p className="text-sm font-bold text-[var(--ifdl-color-success)]">
                          Fila típica ~{item.restaurant.typical_wait_min} min ·
                          promo {item.restaurant.promo_discount_pct ?? 0}%
                        </p>
                      )}
                      <div
                        className={
                          prefersQuietBenefits
                            ? "mt-3 rounded-if border border-neutral-200/80 bg-neutral-50 px-3 py-2"
                            : "mt-3 rounded-if bg-ifood-soft px-3 py-2"
                        }
                      >
                        <p
                          className={
                            prefersQuietBenefits
                              ? "text-xs font-extrabold text-neutral-500"
                              : "text-xs font-extrabold text-ifood"
                          }
                        >
                          {benefitUi.title}
                        </p>
                        <p
                          className={
                            prefersQuietBenefits
                              ? "text-[11px] font-semibold text-neutral-400"
                              : "text-[11px] font-semibold text-muted"
                          }
                        >
                          {benefitUi.detail}
                        </p>
                      </div>
                    </div>
                    <span className="if-btn-primary w-full text-center">
                      Ver Delivery e Comer Fora
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
            <li key={h.restaurantId}>
              <Link
                href={`/cliente/restaurante/${h.restaurantId}`}
                className={`if-card block p-4 transition hover:border-ifood/40 ${
                  h.losingInterest ? "border-amber-200/80" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-title text-base font-extrabold">
                      {h.name}
                    </h3>
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
                    <p className="text-sm font-extrabold text-ink">
                      {h.winbackTitle}
                    </p>
                    <p className="text-[11px] text-muted">{h.winbackDetail}</p>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
