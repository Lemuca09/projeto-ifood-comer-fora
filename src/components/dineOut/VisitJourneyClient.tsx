"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getVisit, setVisitPhase, upsertVisit } from "@/lib/dineOutSession";
import type { CheckInRecord, DineOutVisit, VisitPhase } from "@/domain/dineOut/types";
import { cartTotal } from "@/domain/dineOut/types";
import { brl } from "@/components/analytics/format";
import { buildTableGuests } from "@/domain/dineOut/splitBill";
import { isBenefitUnlocked } from "@/domain/dineOut/progressiveBenefit";

const PHASE_ORDER: VisitPhase[] = [
  "preorder",
  "confirmed",
  "kitchen_started",
  "checked_in",
  "dining",
  "paid",
];

function phaseReached(current: VisitPhase, target: VisitPhase) {
  return PHASE_ORDER.indexOf(current) >= PHASE_ORDER.indexOf(target);
}

export function VisitJourneyClient({
  reservationId,
  restaurantName,
  neighborhood,
  restaurantId,
  slotStartsAt,
  partySize,
}: {
  reservationId: string;
  restaurantName: string;
  neighborhood: string;
  restaurantId: string;
  slotStartsAt: string | null;
  partySize: number;
}) {
  const router = useRouter();
  const [visit, setVisit] = useState<DineOutVisit | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let v = getVisit(reservationId);
    if (!v) {
      v = upsertVisit({
        reservationId,
        restaurantId,
        restaurantName,
        neighborhood,
        cuisine: "Brasileira",
        slotStartsAt,
        partySize,
        phase: "confirmed",
        lines: [],
        kitchenNotifiedAt: null,
        checkedInAt: null,
        paidAt: null,
        benefit: null,
        checkIns: [],
        split: null,
      });
    }
    setVisit(v);

    const hasPreorder = v.lines.some((l) => l.source === "preorder");
    if (v.phase === "confirmed" && hasPreorder && !v.kitchenNotifiedAt) {
      const t = window.setTimeout(() => {
        const next = setVisitPhase(reservationId, "kitchen_started", {
          kitchenNotifiedAt: new Date().toISOString(),
        });
        if (next) setVisit(next);
        setToast(
          "A cozinha já iniciou o preparo do seu pedido antecipado. Faça check-in ao chegar.",
        );
      }, 2200);
      return () => window.clearTimeout(t);
    }
  }, [
    reservationId,
    restaurantId,
    restaurantName,
    neighborhood,
    slotStartsAt,
    partySize,
  ]);

  function addCheckIn(guestId: string, guestName: string) {
    startTransition(() => {
      const cur = getVisit(reservationId);
      if (!cur) return;
      if (cur.checkIns.some((c) => c.guestId === guestId)) return;
      const record: CheckInRecord = {
        guestId,
        guestName,
        at: new Date().toISOString(),
      };
      const checkIns = [...cur.checkIns, record];
      const need = cur.benefit?.requiredCheckIns ?? 1;
      const unlocked = isBenefitUnlocked(
        cur.benefit,
        checkIns.length,
        cartTotal(cur.lines),
      );
      const benefit = cur.benefit
        ? { ...cur.benefit, unlocked }
        : null;
      const phase: VisitPhase =
        checkIns.length >= need ? "checked_in" : cur.phase;
      const next = upsertVisit({
        ...cur,
        checkIns,
        benefit,
        phase,
        checkedInAt: checkIns[0]?.at ?? cur.checkedInAt,
      });
      setVisit(next);
      if (checkIns.length >= need) {
        setToast(
          unlocked
            ? `Check-in completo (${checkIns.length}/${need}). Benefício progressivo liberado.`
            : `Check-in completo (${checkIns.length}/${need}). Benefício ainda depende do ticket mínimo na comanda.`,
        );
      } else {
        setToast(
          `Check-in de ${guestName}: ${checkIns.length}/${need} para liberar o benefício.`,
        );
      }
    });
  }

  function goComanda() {
    startTransition(() => {
      setVisitPhase(reservationId, "dining");
      router.push(`/comanda/${reservationId}`);
    });
  }

  if (!visit) {
    return (
      <div className="if-card animate-pulse p-8 text-center text-sm text-muted">
        Carregando visita…
      </div>
    );
  }

  const preorderLines = visit.lines.filter((l) => l.source === "preorder");
  const total = cartTotal(preorderLines);
  const need = visit.benefit?.requiredCheckIns ?? Math.min(partySize, 2);
  const checked = visit.checkIns.length;
  const guests = buildTableGuests(partySize);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="overflow-hidden rounded-if-lg bg-[var(--ifdl-color-success)] px-5 py-6 text-white shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-white/85">
          Reserva confirmada
        </p>
        <h1 className="font-title mt-1 text-3xl font-extrabold">
          {restaurantName}
        </h1>
        <p className="mt-1 text-sm text-white/90">
          {neighborhood} · {partySize}{" "}
          {partySize === 1 ? "pessoa" : "pessoas"}
          {slotStartsAt
            ? ` · ${new Date(slotStartsAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}`
            : ""}
        </p>
        {visit.benefit && (
          <p className="mt-2 text-xs font-bold text-white/90">
            {visit.benefit.applied ? "Benefício: " : "Sem benefício: "}
            {visit.benefit.title}
          </p>
        )}
      </section>

      {toast && (
        <div
          role="status"
          className="rounded-if border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          <span className="text-[10px] font-bold uppercase text-amber-700">
            Push / status SIMULADO ·{" "}
          </span>
          {toast}
        </div>
      )}

      <section className="if-card space-y-3 p-5">
        <h2 className="font-title text-lg font-extrabold">Sua jornada</h2>
        <ol className="space-y-2 text-sm">
          {(
            [
              { id: "confirmed" as const, label: "Reserva + pré-pedido" },
              { id: "kitchen_started" as const, label: "Cozinha iniciou o preparo" },
              { id: "checked_in" as const, label: "Check-in do grupo" },
              { id: "dining" as const, label: "Comanda digital aberta" },
            ] as const
          ).map((step) => {
            const done =
              phaseReached(visit.phase, step.id) ||
              (step.id === "kitchen_started" && !!visit.kitchenNotifiedAt) ||
              (step.id === "checked_in" && checked >= need);
            return (
              <li
                key={step.id}
                className={`flex items-center gap-2 rounded-if px-3 py-2 ${
                  done ? "bg-ifood-soft text-ifood" : "bg-page text-muted"
                }`}
              >
                <span className="font-extrabold">{done ? "✓" : "○"}</span>
                {step.label}
              </li>
            );
          })}
        </ol>

        {preorderLines.length > 0 && (
          <div className="rounded-if bg-page p-3 text-sm">
            <p className="text-xs font-bold uppercase text-muted">Pré-pedido</p>
            <ul className="mt-2 space-y-1">
              {preorderLines.map((l) => (
                <li key={l.itemId} className="flex justify-between gap-2">
                  <span>
                    {l.qty}× {l.name}
                  </span>
                  <span className="font-bold">{brl(l.unitPriceBrl * l.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right font-title font-extrabold text-ifood">
              {brl(total)}
            </p>
          </div>
        )}
      </section>

      <section className="if-card space-y-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-title text-lg font-extrabold">
              Check-in presencial
            </h2>
            <p className="text-xs text-muted">
              Benefício progressivo exige {need} check-ins · agora {checked}/{need}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
              visit.benefit?.unlocked
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {visit.benefit?.unlocked ? "Desconto liberado" : "Desconto pendente"}
          </span>
        </div>
        <ul className="space-y-2">
          {guests.map((g) => {
            const done = visit.checkIns.some((c) => c.guestId === g.id);
            return (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 rounded-if bg-page px-3 py-2"
              >
                <div>
                  <p className="text-sm font-extrabold">{g.name}</p>
                  <p className="text-[10px] text-muted">{g.handle}</p>
                </div>
                {done ? (
                  <span className="text-xs font-extrabold text-[var(--ifdl-color-success)]">
                    Check-in ok
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded-if bg-ifood px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
                    disabled={pending}
                    onClick={() => addCheckIn(g.id, g.name)}
                  >
                    Check-in
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="if-btn-primary"
            disabled={pending || checked < 1}
            onClick={goComanda}
          >
            Abrir comanda digital
          </button>
          <Link
            href={`/reserva/${reservationId}/pre-pedido`}
            className="if-btn-secondary"
          >
            Ajustar pré-pedido
          </Link>
        </div>
      </section>
    </div>
  );
}
