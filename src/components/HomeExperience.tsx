"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { DiagnosisPanel } from "@/components/DiagnosisPanel";
import { BenefitSearch } from "@/components/BenefitSearch";
import { ReserveConfirmSheet } from "@/components/dineOut/ReserveConfirmSheet";
import { ARCHETYPE_LABELS, type Archetype } from "@/domain/personas";
import { priceRangeLabel } from "@/lib/constants";
import { brl } from "@/components/analytics/format";
import { benefitCopy } from "@/lib/benefitCopy";

const COVER = [
  "from-[#ff6b35] to-[#ea1d2c]",
  "from-[#f7b733] to-[#fc4a1a]",
  "from-[#00b09b] to-[#96c93d]",
];

type ReserveTarget = {
  restaurantId: string;
  restaurantName: string;
  neighborhood: string;
};

export function HomeExperience() {
  const { data, loading, recalculating, error, bootstrap } = useDemoSession();
  const { dash } = useAnalyticsDashboard();
  const [reserveTarget, setReserveTarget] = useState<ReserveTarget | null>(null);

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

  const prefersQuietBenefits = data?.user.archetype === "push_averse";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-if-lg bg-neutral-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="if-card h-56 animate-pulse bg-neutral-100" />
          ))}
        </div>
        <p className="text-center text-sm text-muted">
          Montando sessão e sugestões…
        </p>
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
          diagnóstico orienta, mas você sempre pode reservar.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white px-3 py-1 text-ifood">
            {benefitUi.title}
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

      <BenefitSearch />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-title text-xl font-extrabold">Sugestões pra você</h2>
            <p className="text-xs text-muted">
              Ao reservar: pessoas, disponibilidade e benefício · dados sintéticos
            </p>
          </div>
          <Link href="/metricas" className="text-sm font-bold text-ifood">
            Ver painel analítico →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.recommendations.map((item, idx) => (
            <li key={item.restaurant.id} className="if-card flex flex-col">
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
                    {item.restaurant.neighborhood} · score {item.score.toFixed(0)}
                  </p>
                  {typeof item.restaurant.typical_wait_min === "number" && (
                    <p className="text-sm font-bold text-[var(--ifdl-color-success)]">
                      Fila típica ~{item.restaurant.typical_wait_min} min · promo{" "}
                      {item.restaurant.promo_discount_pct ?? 0}%
                    </p>
                  )}
                  <div
                    className={
                      prefersQuietBenefits
                        ? "mt-3 rounded-if border border-neutral-200/80 bg-neutral-50 px-3 py-2"
                        : "mt-3 rounded-if bg-ifood-soft px-3 py-2"
                    }
                  >
                    <div className="flex items-start gap-2">
                      {prefersQuietBenefits && (
                        <button
                          type="button"
                          className="group relative mt-0.5 inline-flex shrink-0 text-amber-500/80 outline-none"
                          aria-label="Usuário prefere não visualizar benefícios no momento"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          </svg>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-if bg-ink px-2.5 py-1.5 text-center text-[10px] font-semibold leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                          >
                            Usuário prefere não visualizar benefícios no momento
                          </span>
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
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
                  </div>
                </div>
                <button
                  type="button"
                  className="if-btn-primary w-full"
                  onClick={() =>
                    setReserveTarget({
                      restaurantId: item.restaurant.id,
                      restaurantName: item.restaurant.name,
                      neighborhood: item.restaurant.neighborhood,
                    })
                  }
                >
                  Reservar mesa · Comer Fora
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {reserveTarget && (
        <ReserveConfirmSheet
          restaurantId={reserveTarget.restaurantId}
          restaurantName={reserveTarget.restaurantName}
          neighborhood={reserveTarget.neighborhood}
          preferredNeighborhood={data.user.preferred_neighborhood}
          prefersQuietBenefits={prefersQuietBenefits}
          benefit={
            activeBenefit
              ? {
                  cluster: activeBenefit.cluster,
                  clusterLabel: activeBenefit.clusterLabel,
                  benefitType: activeBenefit.benefitType,
                  benefitValueBrl: activeBenefit.benefitValueBrl,
                  giftbackBalanceBrl:
                    activeBenefit.giftbackBalanceBrl ||
                    activeBenefit.benefitValueBrl,
                  avgTicketBrl: Number(data.user.user_avg_ticket_brl),
                  minTicketBrl: activeBenefit.minTicketBrl,
                  freeDishName: activeBenefit.freeDishName,
                }
              : null
          }
          onClose={() => setReserveTarget(null)}
        />
      )}
    </div>
  );
}
