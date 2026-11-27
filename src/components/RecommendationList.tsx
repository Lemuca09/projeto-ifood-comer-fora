"use client";

import { useMemo, useState } from "react";
import type { DiscoveryResult } from "@/domain/types";
import { priceRangeLabel } from "@/lib/constants";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { ReserveConfirmSheet } from "@/components/dineOut/ReserveConfirmSheet";

const COVER = [
  "from-[#ff6b35] to-[#ea1d2c]",
  "from-[#f7b733] to-[#fc4a1a]",
  "from-[#00b09b] to-[#96c93d]",
  "from-[#667eea] to-[#764ba2]",
];

type ReserveTarget = {
  restaurantId: string;
  restaurantName: string;
  neighborhood: string;
};

export function RecommendationList({ data }: { data: DiscoveryResult }) {
  const { data: session } = useDemoSession();
  const { dash } = useAnalyticsDashboard();
  const [reserveTarget, setReserveTarget] = useState<ReserveTarget | null>(null);

  const activeBenefit = useMemo(() => {
    if (!dash || !session) return null;
    return (
      dash.users.find((u) => u.id === session.user.id) ?? dash.users[0] ?? null
    );
  }, [dash, session]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="font-title text-xl font-extrabold text-ink">
            Sugestões pra você
          </h2>
          <p className="text-xs text-muted">
            Confirme pessoas, vaga e benefício · dados sintéticos
          </p>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item, idx) => {
          const slot = item.next_slot;
          return (
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
                  <h3 className="font-title text-lg font-extrabold leading-tight text-ink">
                    {item.restaurant.name}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                    {item.restaurant.description}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-muted">
                    {item.restaurant.neighborhood} · {item.restaurant.address}
                  </p>
                  {slot && (
                    <p className="mt-2 text-sm font-bold text-[var(--ifdl-color-success)]">
                      Próxima mesa{" "}
                      {new Date(slot.starts_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!slot}
                  onClick={() =>
                    setReserveTarget({
                      restaurantId: item.restaurant.id,
                      restaurantName: item.restaurant.name,
                      neighborhood: item.restaurant.neighborhood,
                    })
                  }
                  className="if-btn-primary w-full"
                >
                  Reservar mesa
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {reserveTarget && session && (
        <ReserveConfirmSheet
          restaurantId={reserveTarget.restaurantId}
          restaurantName={reserveTarget.restaurantName}
          neighborhood={reserveTarget.neighborhood}
          preferredNeighborhood={session.user.preferred_neighborhood}
          prefersQuietBenefits={session.user.archetype === "push_averse"}
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
                  avgTicketBrl: Number(session.user.user_avg_ticket_brl),
                  minTicketBrl: activeBenefit.minTicketBrl,
                  freeDishName: activeBenefit.freeDishName,
                }
              : null
          }
          onClose={() => setReserveTarget(null)}
        />
      )}
    </section>
  );
}
