"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExperienceCardPayload } from "@/services/localExperiences";

const COVER_CLASS: Record<ExperienceCardPayload["cover"], string> = {
  sunset:
    "from-[#2a1510] via-[#c45c26] to-[#ea1d2c]",
  harbor:
    "from-[#0c1b2a] via-[#1a4a6e] to-[#3d7ea6]",
  heritage:
    "from-[#1c140e] via-[#6b4423] to-[#a67c52]",
  family:
    "from-[#1a2e1a] via-[#3d6b3d] to-[#7a9e4e]",
  seafood:
    "from-[#0e2433] via-[#1f5c6b] to-[#4a9bb0]",
  night:
    "from-[#0a0a12] via-[#2a1840] to-[#ea1d2c]",
};

type Props = {
  neighborhood: string;
  partySize: number;
  /** Benefício ativo da conta — só exibir se houver (não inventar). */
  accountBenefitLabel: string | null;
  prefersQuietBenefits?: boolean;
};

export function LocalExperiences({
  neighborhood,
  partySize,
  accountBenefitLabel,
  prefersQuietBenefits = false,
}: Props) {
  const [items, setItems] = useState<ExperienceCardPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({
      neighborhood,
      partySize: String(partySize),
      limit: "6",
    });

    void fetch(`/api/experiences?${qs}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Falha ao carregar experiências");
        if (!cancelled) {
          setItems((json.experiences ?? []) as ExperienceCardPayload[]);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [neighborhood, partySize]);

  if (loading) {
    return (
      <section className="space-y-3">
        <Header neighborhood={neighborhood} />
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-72 w-[min(85vw,300px)] shrink-0 animate-pulse rounded-if-lg bg-neutral-100"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        <Header neighborhood={neighborhood} />
        <p className="rounded-if border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {error}
        </p>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <Header neighborhood={neighborhood} />

      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {items.map((item) => {
          const cover = COVER_CLASS[item.cover] ?? COVER_CLASS.harbor;
          const showAccountBenefit =
            !!accountBenefitLabel && !prefersQuietBenefits;
          const showPromo =
            typeof item.restaurantPromoPct === "number" &&
            item.restaurantPromoPct > 0;

          return (
            <article
              key={`${item.trailId}-${item.restaurant.id}`}
              className="if-card flex w-[min(85vw,300px)] shrink-0 snap-start flex-col"
            >
              <div
                className={`relative h-40 overflow-hidden bg-gradient-to-br ${cover}`}
              >
                {/* Textura editorial (sem foto fictícia de produto/promo) */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 30%, rgba(255,255,255,.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(0,0,0,.35), transparent 50%)",
                  }}
                />
                <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink shadow-sm">
                  {item.badge}
                </span>
                <span className="absolute bottom-3 left-3 right-3 text-[11px] font-semibold text-white/90">
                  {item.inUserNeighborhood
                    ? item.restaurant.neighborhood
                    : `Santos · ${item.restaurant.neighborhood}`}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex-1 space-y-1.5">
                  <h3 className="font-title text-[15px] font-extrabold leading-snug text-ink">
                    {item.title}
                  </h3>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                    {item.story}
                  </p>

                  {item.availableSlots.length > 0 ? (
                    <p className="pt-1 text-[11px] font-bold text-[var(--ifdl-color-success)]">
                      Mesas livres: {item.availableSlots.join(" · ")}
                    </p>
                  ) : (
                    <p className="pt-1 text-[11px] font-semibold text-muted">
                      Sem mesa livre neste momento — veja outros horários no
                      salão
                    </p>
                  )}

                  {showPromo && (
                    <p className="text-[11px] font-semibold text-ifood">
                      {item.restaurantPromoPct}% de desconto no salão
                      (cadastro do restaurante)
                    </p>
                  )}

                  {showAccountBenefit && (
                    <p className="text-[11px] font-semibold text-ifood">
                      Seu Comer Fora: {accountBenefitLabel}
                    </p>
                  )}
                </div>

                <Link
                  href={`/cliente/restaurante/${item.restaurant.id}`}
                  className="if-btn-primary w-full text-center text-sm"
                >
                  Agendar mesa
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Header({ neighborhood }: { neighborhood: string }) {
  return (
    <div>
      <h2 className="font-title text-xl font-extrabold">
        Descubra a cidade
      </h2>
      <p className="text-xs text-muted">
        Experiências gastronômicas locais · Santos · prioridade em{" "}
        {neighborhood}
      </p>
    </div>
  );
}
