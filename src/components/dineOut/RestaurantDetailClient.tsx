"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { ReserveConfirmSheet } from "@/components/dineOut/ReserveConfirmSheet";
import {
  buildMenu,
  freeDishForRestaurant,
  inferCuisine,
} from "@/domain/dineOut/menu";
import { benefitCopy } from "@/lib/benefitCopy";
import { priceRangeLabel } from "@/lib/constants";
import { brl } from "@/components/analytics/format";
import type { CatalogRestaurant } from "@/services/restaurants";

type TabId = "delivery" | "comer-fora";

const COVER = [
  "from-[#ff6b35] to-[#ea1d2c]",
  "from-[#f7b733] to-[#fc4a1a]",
  "from-[#00b09b] to-[#96c93d]",
  "from-[#667eea] to-[#764ba2]",
];

type Props = {
  restaurant: CatalogRestaurant;
  initialTab?: TabId;
};

export function RestaurantDetailClient({ restaurant, initialTab }: Props) {
  const { data } = useDemoSession();
  const { dash } = useAnalyticsDashboard();
  const [tab, setTab] = useState<TabId>(initialTab ?? "delivery");
  const [reserveOpen, setReserveOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const syncingFromClick = useRef(false);

  const cover = COVER[restaurant.name.length % COVER.length];
  const cuisine = useMemo(
    () => inferCuisine(restaurant.name, restaurant.description),
    [restaurant.name, restaurant.description],
  );
  const menu = useMemo(
    () => buildMenu(cuisine, restaurant.id),
    [cuisine, restaurant.id],
  );

  const activeBenefit = useMemo(() => {
    if (!dash || !data) return null;
    return (
      dash.users.find((u) => u.id === data.user.id) ?? dash.users[0] ?? null
    );
  }, [dash, data]);

  const localizedFreeDish = useMemo(() => {
    if (!activeBenefit || activeBenefit.benefitType !== "prato_gratis") {
      return activeBenefit?.freeDishName ?? null;
    }
    return freeDishForRestaurant(
      restaurant.name,
      restaurant.description,
      activeBenefit.code,
    ).name;
  }, [activeBenefit, restaurant.name, restaurant.description]);

  const benefitUi = activeBenefit
    ? benefitCopy({
        ...activeBenefit,
        freeDishName: localizedFreeDish,
      })
    : { title: "Benefício no salão", detail: "Carregando…", minSpendLine: null };

  const prefersQuietBenefits = data?.user.archetype === "push_averse";

  const goToTab = useCallback((next: TabId) => {
    setTab(next);
    const scroller = scrollerRef.current;
    if (!scroller) return;
    syncingFromClick.current = true;
    const index = next === "delivery" ? 0 : 1;
    scroller.scrollTo({
      left: index * scroller.clientWidth,
      behavior: "smooth",
    });
    window.setTimeout(() => {
      syncingFromClick.current = false;
    }, 400);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !initialTab || initialTab === "delivery") return;
    scroller.scrollTo({ left: scroller.clientWidth });
  }, [initialTab]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    function onScroll() {
      if (syncingFromClick.current || !scroller) return;
      const index = Math.round(scroller.scrollLeft / scroller.clientWidth);
      setTab(index >= 1 ? "comer-fora" : "delivery");
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  const categories = ["prato", "bebida", "sobremesa"] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <Link href="/cliente" className="text-ifood hover:underline">
          ← Cliente
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-ink">{restaurant.name}</span>
      </div>

      <section
        className={`overflow-hidden rounded-if-lg bg-gradient-to-br ${cover} px-5 py-7 text-white shadow-if`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ifood">
            {priceRangeLabel(restaurant.price_range)}
          </span>
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold">
            {restaurant.neighborhood}
          </span>
          {restaurant.is_synthetic && (
            <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold">
              Dados sintéticos
            </span>
          )}
        </div>
        <h1 className="font-title mt-3 text-3xl font-extrabold">
          {restaurant.name}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          {restaurant.description ?? `${cuisine} · ${restaurant.address}`}
        </p>
        <p className="mt-2 text-xs font-semibold text-white/75">
          {restaurant.address}
          {typeof restaurant.typical_wait_min === "number"
            ? ` · fila típica ~${restaurant.typical_wait_min} min`
            : ""}
          {typeof restaurant.promo_discount_pct === "number" &&
          restaurant.promo_discount_pct > 0
            ? ` · promo ${restaurant.promo_discount_pct}%`
            : ""}
        </p>
      </section>

      <div
        role="tablist"
        aria-label="Modo do restaurante"
        className="sticky top-0 z-20 -mx-1 flex rounded-if border border-[var(--ifdl-color-border)] bg-white/95 p-1 shadow-sm backdrop-blur"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "delivery"}
          className={`flex-1 rounded-if px-3 py-2.5 text-sm font-extrabold transition ${
            tab === "delivery"
              ? "bg-ifood text-white shadow-sm"
              : "text-muted hover:text-ink"
          }`}
          onClick={() => goToTab("delivery")}
        >
          Delivery
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "comer-fora"}
          className={`flex-1 rounded-if px-3 py-2.5 text-sm font-extrabold transition ${
            tab === "comer-fora"
              ? "bg-ifood text-white shadow-sm"
              : "text-muted hover:text-ink"
          }`}
          onClick={() => goToTab("comer-fora")}
        >
          Comer Fora
        </button>
      </div>

      <p className="text-center text-[11px] font-semibold text-muted sm:hidden">
        Deslize horizontalmente para alternar as abas
      </p>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <section
          role="tabpanel"
          aria-hidden={tab !== "delivery"}
          className="w-full shrink-0 snap-center space-y-3 px-0.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-title text-lg font-extrabold">Cardápio delivery</h2>
              <p className="text-xs text-muted">
                Referência visual · sem carrinho ou checkout
              </p>
            </div>
            <span className="synth-badge">SIMULADO</span>
          </div>

          {categories.map((cat) => (
            <div key={cat} className="if-card p-4">
              <h3 className="font-title text-sm font-extrabold capitalize text-ink">
                {cat === "prato"
                  ? "Pratos"
                  : cat === "bebida"
                    ? "Bebidas"
                    : "Sobremesas"}
              </h3>
              <ul className="mt-3 space-y-2">
                {menu
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-if bg-page px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{m.name}</p>
                        <p className="text-[11px] text-muted">
                          {brl(m.priceBrl)} · prep ~{m.prepMin} min
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase text-muted">
                        Só visual
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

          <button
            type="button"
            className="if-btn-secondary w-full"
            onClick={() => goToTab("comer-fora")}
          >
            Preferir mesa? Ver Comer Fora →
          </button>
        </section>

        <section
          role="tabpanel"
          aria-hidden={tab !== "comer-fora"}
          className="w-full shrink-0 snap-center space-y-3 px-0.5"
        >
          <div>
            <h2 className="font-title text-lg font-extrabold">Comer Fora</h2>
            <p className="text-xs text-muted">
              Reserve mesa com o fluxo já existente do produto
            </p>
          </div>

          <div
            className={
              prefersQuietBenefits
                ? "rounded-if border border-neutral-200/80 bg-neutral-50 px-3 py-3"
                : "rounded-if bg-ifood-soft px-3 py-3"
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
            {benefitUi.minSpendLine && (
              <p className="mt-1 text-[11px] font-bold text-muted">
                {benefitUi.minSpendLine}
              </p>
            )}
          </div>

          <div className="if-card space-y-2 p-4">
            <h3 className="font-title text-sm font-extrabold">No salão</h3>
            <ul className="space-y-1.5 text-sm text-muted">
              <li>
                · Culinária inferida: <strong className="text-ink">{cuisine}</strong>
              </li>
              <li>
                · Faixa:{" "}
                <strong className="text-ink">
                  {priceRangeLabel(restaurant.price_range, "label")}
                </strong>
              </li>
              {typeof restaurant.idle_capacity_pct === "number" && (
                <li>
                  · Ociosidade típica:{" "}
                  <strong className="text-ink">
                    {Math.round(restaurant.idle_capacity_pct)}%
                  </strong>
                </li>
              )}
              {restaurant.occasion_tags?.length > 0 && (
                <li>
                  · Ocasiões:{" "}
                  <strong className="text-ink">
                    {restaurant.occasion_tags.join(", ")}
                  </strong>
                </li>
              )}
            </ul>
          </div>

          <button
            type="button"
            className="if-btn-primary w-full"
            disabled={!data}
            onClick={() => setReserveOpen(true)}
          >
            Reservar mesa · Comer Fora
          </button>
          <p className="text-center text-[11px] text-muted">
            Abre o mesmo fluxo de confirmação (pessoas, vaga e benefício) usado
            no Início.
          </p>
        </section>
      </div>

      {reserveOpen && data && (
        <ReserveConfirmSheet
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          neighborhood={restaurant.neighborhood}
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
                  freeDishName: localizedFreeDish,
                }
              : null
          }
          onClose={() => setReserveOpen(false)}
        />
      )}
    </div>
  );
}
