"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { BenefitSearch } from "@/components/BenefitSearch";
import { LocalExperiences } from "@/components/dineOut/LocalExperiences";
import { buildClientHistoryFromCatalog } from "@/domain/dineOut/clientView";
import { benefitCopy } from "@/lib/benefitCopy";
import { freeDishForRestaurant } from "@/domain/dineOut/menu";
import { partySizeFromMode } from "@/lib/dineTime";
import { priceRangeLabel } from "@/lib/constants";
import type { PartySizeMode } from "@/domain/personas";
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

  function benefitForRestaurant(
    name: string,
    description?: string | null,
  ): { title: string; detail: string } {
    if (!enriched) {
      return {
        title: benefitUi.title,
        detail: benefitUi.detail,
      };
    }
    const dish =
      enriched.benefitType === "prato_gratis"
        ? freeDishForRestaurant(name, description, enriched.code)
        : null;
    const copy = benefitCopy({
      benefitType: enriched.benefitType,
      benefitValueBrl: enriched.benefitValueBrl,
      minTicketBrl: enriched.minTicketBrl,
      freeDishName: dish?.name ?? enriched.freeDishName,
      strategy: enriched.strategy,
    });
    return {
      title: copy.title,
      detail:
        enriched.minTicketBrl > 0
          ? `${copy.detail} · libera com gastos acima de R$ ${enriched.minTicketBrl.toFixed(0)}`
          : copy.detail,
    };
  }

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
          Abra um restaurante para ver Delivery e Comer Fora no mesmo lugar -
          reserve a mesa sem passar pelo perfil.
        </p>
      </section>

      <BenefitSearch />

      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-title text-xl font-extrabold">
              Recomendações personalizadas
            </h2>
            <div className="group relative inline-flex">
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--ifdl-color-border)] bg-white text-[11px] font-bold text-muted transition hover:border-ifood hover:text-ifood focus:outline-none focus-visible:ring-2 focus-visible:ring-ifood"
                aria-label="Como as recomendações são feitas"
                aria-describedby="reco-client-hint"
              >
                i
              </button>
              <div
                id="reco-client-hint"
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-[80] mt-2 w-[min(92vw,24rem)] rounded-if border border-[var(--ifdl-color-border)] bg-white p-3 text-left text-[11px] leading-relaxed text-ink opacity-0 shadow-if transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <p className="font-extrabold text-ifood">
                  Como montei esta vitrine
                </p>
                <p className="mt-1.5 text-muted">
                  Só entram restaurantes{" "}
                  <span className="font-semibold text-ink">ativos no banco</span>{" "}
                  do bairro da persona (
                  {data.user.preferred_neighborhood}). No bootstrap, o motor de
                  decisão ranqueia e guarda o top 3; se a sessão ainda não tiver
                  ranking, usamos o catálogo do bairro na ordem do banco.
                </p>
                <p className="mt-2 font-extrabold text-ink">Score (ranking)</p>
                <p className="mt-1 text-muted">
                  Parte de 40 e soma pontos:{" "}
                  <span className="font-semibold text-ink">+25</span> mesmo
                  bairro, <span className="font-semibold text-ink">+20</span>{" "}
                  promo ≥10%,{" "}
                  <span className="font-semibold text-ink">+15</span> fila típica
                  &lt;15 min, bônus por arquétipo (ex.: speed_seeker com fila
                  curta, delivery_focused com promo alta), ajuste por faixa de
                  preço. Modo silencioso ou “não recomendar sair” reduz o score.
                  O badge (#1 · motivo) usa o reason code dominante (vaga, preço,
                  perto…).
                </p>
                <p className="mt-2 font-extrabold text-ink">
                  O que aparece no card
                </p>
                <ul className="mt-1 space-y-1 text-muted">
                  <li>
                    <span className="font-semibold text-ink">Faixa R$:</span>{" "}
                    price_range do cadastro
                  </li>
                  <li>
                    <span className="font-semibold text-ink">Fila / promo %:</span>{" "}
                    typical_wait_min e promo_discount_pct do restaurante
                  </li>
                  <li>
                    <span className="font-semibold text-ink">Cupom / benefício:</span>{" "}
                    tipo da <em>conta</em> (cupom/giftback/prato); se for prato
                    grátis, o item segue a culinária do restaurante
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted">
            Catálogo do banco · {data.user.preferred_neighborhood}                     · mesmos
            cards de O Projeto
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
            {recommendations.map((item, idx) => {
              const cardBenefit = benefitForRestaurant(
                item.restaurant.name,
                item.restaurant.description,
              );
              return (
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
                          Fila típica ~{item.restaurant.typical_wait_min} min
                          {typeof item.restaurant.promo_discount_pct ===
                            "number" &&
                          item.restaurant.promo_discount_pct > 0
                            ? ` · promo ${item.restaurant.promo_discount_pct}%`
                            : ""}
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
                          {cardBenefit.title}
                        </p>
                        <p
                          className={
                            prefersQuietBenefits
                              ? "text-[11px] font-semibold text-neutral-400"
                              : "text-[11px] font-semibold text-muted"
                          }
                        >
                          {cardBenefit.detail}
                        </p>
                      </div>
                    </div>
                    <span className="if-btn-primary w-full text-center">
                      Ver Delivery e Comer Fora
                    </span>
                  </div>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <LocalExperiences
        neighborhood={data.user.preferred_neighborhood}
        partySize={partySizeFromMode(
          (data.user.party_size_mode ?? "2") as PartySizeMode,
        )}
        accountBenefitLabel={
          enriched &&
          enriched.benefitType !== "nenhum" &&
          benefitUi.title !== "Sem desconto por agora"
            ? benefitUi.title
            : null
        }
        prefersQuietBenefits={prefersQuietBenefits}
      />

      <section className="space-y-3">
        <div>
          <h2 className="font-title text-xl font-extrabold">
            Histórico e retenção
          </h2>
          <p className="text-xs text-muted">
            Anti-churn: benefícios exclusivos quando a recorrência cai
          </p>
        </div>
        {history.length === 0 ? (
          <p className="if-card p-4 text-sm text-muted">
            Ainda sem histórico neste bairro.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((h, idx) => (
              <li key={h.restaurantId}>
                <Link
                  href={`/cliente/restaurante/${h.restaurantId}`}
                  className={`if-card flex h-full flex-col transition hover:border-ifood/40 ${
                    h.losingInterest ? "border-amber-200/80" : ""
                  }`}
                >
                  <div
                    className={`relative h-32 bg-gradient-to-br sm:h-36 ${COVER[idx % COVER.length]}`}
                  >
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ifood shadow-sm">
                      {h.isFavorite
                        ? "Favorito"
                        : h.losingInterest
                          ? "Perdendo interesse"
                          : "Histórico"}
                    </span>
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-1 text-[11px] font-bold text-white">
                      {priceRangeLabel(h.priceRange)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col space-y-2 p-4">
                    <div className="flex-1">
                      <h3 className="font-title text-lg font-extrabold">
                        {h.name}
                      </h3>
                      {h.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                          {h.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs font-semibold text-muted">
                        {h.neighborhood} · última visita há {h.lastVisitDaysAgo}{" "}
                        dias · {h.visits90d} visitas / 90d
                      </p>
                      {typeof h.typicalWaitMin === "number" && (
                        <p className="text-sm font-bold text-[var(--ifdl-color-success)]">
                          Fila típica ~{h.typicalWaitMin} min
                          {typeof h.promoDiscountPct === "number" &&
                          h.promoDiscountPct > 0
                            ? ` · promo ${h.promoDiscountPct}%`
                            : ""}
                        </p>
                      )}
                      <div
                        className={
                          prefersQuietBenefits
                            ? "mt-3 rounded-if border border-neutral-200/80 bg-neutral-50 px-3 py-2"
                            : h.winbackTitle
                              ? "mt-3 rounded-if border border-dashed border-ifood/30 bg-ifood-soft/50 px-3 py-2"
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
                          {h.winbackTitle
                            ? `Reativação · ${h.winbackTitle}`
                            : benefitUi.title}
                        </p>
                        <p
                          className={
                            prefersQuietBenefits
                              ? "text-[11px] font-semibold text-neutral-400"
                              : "text-[11px] font-semibold text-muted"
                          }
                        >
                          {h.winbackDetail ?? benefitUi.detail}
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
    </div>
  );
}
