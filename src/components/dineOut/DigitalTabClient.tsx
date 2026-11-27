"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { buildMenu, inferCuisine } from "@/domain/dineOut/menu";
import type {
  CartLine,
  DineOutVisit,
  SplitPaymentState,
} from "@/domain/dineOut/types";
import { cartTotal } from "@/domain/dineOut/types";
import {
  getVisit,
  setVisitLines,
  setVisitPhase,
  upsertVisit,
} from "@/lib/dineOutSession";
import { brl } from "@/components/analytics/format";
import { isBenefitUnlocked } from "@/domain/dineOut/progressiveBenefit";
import { buildTableGuests } from "@/domain/dineOut/splitBill";
import { SplitBillSheet } from "@/components/dineOut/SplitBillSheet";

export function DigitalTabClient({ reservationId }: { reservationId: string }) {
  const [visit, setVisit] = useState<DineOutVisit | null>(null);
  const [pending, startTransition] = useTransition();
  const [paidFlash, setPaidFlash] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    setVisit(getVisit(reservationId));
  }, [reservationId]);

  const menu = useMemo(() => {
    if (!visit) return [];
    return buildMenu(
      visit.cuisine || inferCuisine(visit.restaurantName),
      visit.restaurantId,
    );
  }, [visit]);

  if (!visit) {
    return (
      <div className="if-card space-y-3 p-6 text-center">
        <h1 className="font-title text-xl font-extrabold">Comanda não encontrada</h1>
        <p className="text-sm text-muted">
          Faça uma reserva e o check-in para abrir a comanda digital.
        </p>
        <Link href="/" className="if-btn-primary inline-flex">
          Ir ao início
        </Link>
      </div>
    );
  }

  const subtotal = cartTotal(visit.lines);
  const unlocked = isBenefitUnlocked(
    visit.benefit,
    visit.checkIns?.length ?? 0,
    subtotal,
  );
  const discount =
    unlocked && visit.benefit?.applied
      ? visit.benefit.benefitType === "prato_gratis"
        ? Math.min(subtotal * 0.25, 45)
        : Math.min(visit.benefit.benefitValueBrl, subtotal)
      : 0;
  const total = Math.max(0, Number((subtotal - discount).toFixed(2)));
  const isPaid = visit.phase === "paid";
  const split = visit.split;

  function refreshBenefit(nextVisit: DineOutVisit) {
    const u = isBenefitUnlocked(
      nextVisit.benefit,
      nextVisit.checkIns?.length ?? 0,
      cartTotal(nextVisit.lines),
    );
    if (!nextVisit.benefit || nextVisit.benefit.unlocked === u) return nextVisit;
    return upsertVisit({
      ...nextVisit,
      benefit: { ...nextVisit.benefit, unlocked: u },
    });
  }

  function addItem(itemId: string) {
    const item = menu.find((m) => m.id === itemId);
    if (!item || isPaid) return;
    // Só soma em linha "mesa" — nunca mistura com pré-pedido
    const existingTable = visit!.lines.find(
      (l) => l.itemId === itemId && l.source === "table",
    );
    let lines: CartLine[];
    if (existingTable) {
      lines = visit!.lines.map((l) =>
        l.itemId === itemId && l.source === "table"
          ? { ...l, qty: l.qty + 1 }
          : l,
      );
    } else {
      lines = [
        ...visit!.lines,
        {
          itemId: item.id,
          name: item.name,
          unitPriceBrl: item.priceBrl,
          qty: 1,
          source: "table",
        },
      ];
    }
    const base = setVisitLines(reservationId, lines);
    if (!base) return;
    const next = refreshBenefit({ ...base, phase: "dining" });
    setVisit(next);
  }

  function saveSplit(state: SplitPaymentState) {
    const cur = getVisit(reservationId);
    if (!cur) return;
    const next = upsertVisit({ ...cur, split: state, phase: "dining" });
    setVisit(next);
    setSplitOpen(false);
  }

  function payShare(guestId: string) {
    startTransition(() => {
      const cur = getVisit(reservationId);
      if (!cur?.split) return;
      const shares = cur.split.shares.map((s) =>
        s.guestId === guestId ? { ...s, paid: true } : s,
      );
      const allPaid = shares.every((s) => s.paid);
      const next = upsertVisit({
        ...cur,
        split: { ...cur.split, shares },
        phase: allPaid ? "paid" : cur.phase,
        paidAt: allPaid ? new Date().toISOString() : cur.paidAt,
      });
      setVisit(next);
      if (allPaid) setPaidFlash(true);
    });
  }

  function payFull() {
    startTransition(() => {
      const next = setVisitPhase(reservationId, "paid", {
        paidAt: new Date().toISOString(),
      });
      if (next) {
        setVisit(next);
        setPaidFlash(true);
      }
    });
  }

  const need = visit.benefit?.requiredCheckIns ?? 1;
  const checked = visit.checkIns?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="overflow-hidden rounded-if-lg bg-gradient-to-r from-ink to-neutral-700 px-5 py-6 text-white shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-white/75">
          Comanda digital · iFood Comer Fora
        </p>
        <h1 className="font-title mt-1 text-2xl font-extrabold">
          {visit.restaurantName}
        </h1>
        <p className="mt-1 text-sm text-white/85">
          Consumo em tempo real · split bill · pagamento no app
        </p>
      </section>

      {paidFlash && (
        <div className="rounded-if border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          <span className="text-[10px] font-bold uppercase text-emerald-700">
            Pagamento SIMULADO ·{" "}
          </span>
          Conta quitada. Obrigado — até a próxima visita.
        </div>
      )}

      {visit.benefit?.applied && (
        <div
          className={`rounded-if px-3 py-2 ${
            unlocked
              ? "border border-emerald-200 bg-emerald-50"
              : "border border-amber-200 bg-amber-50"
          }`}
        >
          <p className="text-[10px] font-bold uppercase text-muted">
            Benefício progressivo
          </p>
          <p className="text-sm font-extrabold text-ink">{visit.benefit.title}</p>
          <p className="text-[11px] text-muted">
            Check-ins {checked}/{need}
            {visit.benefit.minTicketBrl > 0
              ? ` · ticket mín. ${brl(visit.benefit.minTicketBrl)}`
              : ""}
            {unlocked
              ? ` · desconto ${brl(discount)} aplicado`
              : " · ainda não liberado"}
          </p>
        </div>
      )}

      <section className="if-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-title text-lg font-extrabold">Sua conta</h2>
          <span className="text-[10px] font-bold uppercase text-muted">
            {isPaid ? "Paga" : "Aberta"}
          </span>
        </div>
        {visit.lines.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum item ainda.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {(["preorder", "table"] as const).map((source) => {
              const group = visit.lines.filter((l) => l.source === source);
              if (group.length === 0) return null;
              const groupTotal = group.reduce(
                (s, l) => s + l.unitPriceBrl * l.qty,
                0,
              );
              return (
                <div key={source}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    {source === "preorder"
                      ? "Pré-pedido"
                      : "Durante a refeição no salão"}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {group.map((l) => (
                      <li
                        key={`${l.itemId}-${l.source}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="font-bold">
                          {l.qty}× {l.name}
                        </span>
                        <span className="font-bold">
                          {brl(l.unitPriceBrl * l.qty)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-right text-[11px] font-semibold text-muted">
                    Subtotal{" "}
                    {source === "preorder" ? "pré-pedido" : "salão"}:{" "}
                    {brl(groupTotal)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 space-y-1 border-t border-[var(--ifdl-color-border)] pt-3 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span>{brl(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between font-semibold text-[var(--ifdl-color-success)]">
              <span>Benefício</span>
              <span>−{brl(discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted">Total</span>
            <span className="font-title text-xl font-extrabold text-ifood">
              {brl(total)}
            </span>
          </div>
        </div>

        {!isPaid && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="if-btn-primary flex-1"
              disabled={pending || total <= 0}
              onClick={payFull}
            >
              {pending ? "Processando…" : "Pagar tudo no iFood"}
            </button>
            <button
              type="button"
              className="if-btn-secondary"
              disabled={total <= 0}
              onClick={() => setSplitOpen(true)}
            >
              Dividir conta
            </button>
          </div>
        )}
      </section>

      {split && (
        <section className="if-card space-y-3 p-4">
          <h2 className="font-title text-sm font-extrabold">
            Cobranças individuais ({split.mode})
          </h2>
          <ul className="space-y-2">
            {split.shares.map((s) => {
              const g = buildTableGuests(visit.partySize).find(
                (x) => x.id === s.guestId,
              );
              return (
                <li
                  key={s.guestId}
                  className="flex items-center justify-between gap-2 rounded-if bg-page px-3 py-2 text-sm"
                >
                  <span className="font-bold">{g?.name ?? s.guestId}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-extrabold text-ifood">
                      {brl(s.amountBrl)}
                    </span>
                    {s.paid ? (
                      <span className="text-[10px] font-extrabold uppercase text-[var(--ifdl-color-success)]">
                        Pago
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="rounded-if bg-ifood px-2 py-1 text-[10px] font-extrabold text-white disabled:opacity-50"
                        disabled={pending || isPaid}
                        onClick={() => payShare(s.guestId)}
                      >
                        Pagar parte
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-muted">
            Cada cobrança usa o método salvo no app do convidado (SIMULADO).
          </p>
        </section>
      )}

      {!isPaid && (
        <section className="if-card p-4">
          <h2 className="font-title text-sm font-extrabold">
            Adicionar durante a refeição
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {menu.slice(0, 8).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-if border border-[var(--ifdl-color-border)] bg-page px-3 py-2 text-left text-sm transition hover:border-ifood/40"
                  onClick={() => addItem(m.id)}
                >
                  <span className="min-w-0 truncate font-bold">{m.name}</span>
                  <span className="shrink-0 text-xs font-extrabold text-ifood">
                    + {brl(m.priceBrl)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href={`/visita/${reservationId}`} className="if-btn-secondary inline-flex">
        Voltar à visita / check-ins
      </Link>

      {splitOpen && (
        <SplitBillSheet
          partySize={visit.partySize}
          lines={visit.lines}
          totalBrl={subtotal}
          discountBrl={discount}
          onClose={() => setSplitOpen(false)}
          onConfirm={saveSplit}
        />
      )}
    </div>
  );
}
