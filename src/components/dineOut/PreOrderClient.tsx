"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildMenu, inferCuisine } from "@/domain/dineOut/menu";
import type { AppliedBenefit, CartLine } from "@/domain/dineOut/types";
import { cartTotal } from "@/domain/dineOut/types";
import { getVisit, upsertVisit } from "@/lib/dineOutSession";
import { brl } from "@/components/analytics/format";

type Props = {
  reservationId: string;
  restaurantId: string;
  restaurantName: string;
  neighborhood: string;
  slotStartsAt: string | null;
  partySize: number;
};

export function PreOrderClient(props: Props) {
  const router = useRouter();
  const cuisine = useMemo(
    () => inferCuisine(props.restaurantName),
    [props.restaurantName],
  );
  const menu = useMemo(
    () => buildMenu(cuisine, props.restaurantId),
    [cuisine, props.restaurantId],
  );
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [benefit, setBenefit] = useState<AppliedBenefit | null>(null);

  useEffect(() => {
    setBenefit(getVisit(props.reservationId)?.benefit ?? null);
  }, [props.reservationId]);

  const lines: CartLine[] = menu
    .filter((m) => (qty[m.id] ?? 0) > 0)
    .map((m) => ({
      itemId: m.id,
      name: m.name,
      unitPriceBrl: m.priceBrl,
      qty: qty[m.id]!,
      source: "preorder" as const,
    }));

  const total = cartTotal(lines);
  const categories = ["prato", "bebida", "sobremesa"] as const;

  function bump(id: string, delta: number) {
    setQty((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  function persistAndGo(nextLines: typeof lines) {
    startTransition(() => {
      const prev = getVisit(props.reservationId);
      upsertVisit({
        reservationId: props.reservationId,
        restaurantId: props.restaurantId,
        restaurantName: props.restaurantName,
        neighborhood: props.neighborhood,
        cuisine,
        slotStartsAt: props.slotStartsAt,
        partySize: props.partySize,
        phase: "confirmed",
        lines: nextLines,
        kitchenNotifiedAt: null,
        checkedInAt: null,
        paidAt: null,
        benefit: prev?.benefit ?? null,
        checkIns: prev?.checkIns ?? [],
        split: prev?.split ?? null,
      });
      router.push(`/visita/${props.reservationId}`);
    });
  }

  function confirm() {
    persistAndGo(lines);
  }

  function skip() {
    persistAndGo([]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="overflow-hidden rounded-if-lg bg-gradient-to-br from-ifood to-ifood-dark px-5 py-6 text-white shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Pedido antecipado · Comer Fora
        </p>
        <h1 className="font-title mt-1 text-2xl font-extrabold sm:text-3xl">
          Escolha o que vai pedir
        </h1>
        <p className="mt-2 text-sm text-white/90">
          {props.restaurantName} · {props.neighborhood} · {cuisine} ·{" "}
          {props.partySize} {props.partySize === 1 ? "pessoa" : "pessoas"}. A
          cozinha começa perto do seu horário; no check-in os pratos saem na mesa.
        </p>
      </section>

      {benefit && (
        <div
          className={`rounded-if px-3 py-2 ${
            benefit.applied
              ? "bg-ifood-soft"
              : "border border-neutral-200 bg-neutral-50"
          }`}
        >
          <p className="text-[10px] font-bold uppercase text-muted">
            {benefit.applied
              ? "Benefício aplicado na reserva"
              : "Benefício não aplicado"}
          </p>
          <p
            className={`text-sm font-extrabold ${
              benefit.applied ? "text-ifood" : "text-neutral-500"
            }`}
          >
            {benefit.title}
          </p>
          <p className="text-[11px] text-muted">{benefit.detail}</p>
        </div>
      )}

      {categories.map((cat) => (
        <section key={cat} className="if-card p-4">
          <h2 className="font-title text-sm font-extrabold capitalize text-ink">
            {cat === "prato" ? "Pratos" : cat === "bebida" ? "Bebidas" : "Sobremesas"}
          </h2>
          <ul className="mt-3 space-y-2">
            {menu
              .filter((m) => m.category === cat)
              .map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-if bg-page px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{m.name}</p>
                    <p className="text-[11px] text-muted">
                      {brl(m.priceBrl)} · prep ~{m.prepMin} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full border border-[var(--ifdl-color-border)] bg-white text-sm font-bold"
                      onClick={() => bump(m.id, -1)}
                      aria-label={`Remover ${m.name}`}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-extrabold">
                      {qty[m.id] ?? 0}
                    </span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full bg-ifood text-sm font-bold text-white"
                      onClick={() => bump(m.id, 1)}
                      aria-label={`Adicionar ${m.name}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-20 z-10 space-y-2 rounded-if-lg border border-ifood/20 bg-white p-4 shadow-if md:bottom-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-muted">
            {lines.reduce((s, l) => s + l.qty, 0)} itens pré-pedido
          </span>
          <span className="font-title text-lg font-extrabold text-ifood">
            {brl(total)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="if-btn-primary flex-1"
            disabled={pending || lines.length === 0}
            onClick={confirm}
          >
            Confirmar pré-pedido
          </button>
          <button
            type="button"
            className="if-btn-secondary"
            disabled={pending}
            onClick={skip}
          >
            Pular
          </button>
        </div>
      </div>
    </div>
  );
}
