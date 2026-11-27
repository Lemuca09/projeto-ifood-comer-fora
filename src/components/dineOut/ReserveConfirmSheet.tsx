"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brl } from "@/components/analytics/format";
import { upsertVisit } from "@/lib/dineOutSession";
import { inferCuisine } from "@/domain/dineOut/menu";
import {
  progressiveBenefitForParty,
  toAppliedBenefit,
} from "@/domain/dineOut/progressiveBenefit";
import type { AppliedBenefit } from "@/domain/dineOut/types";

type BenefitInput = {
  cluster?: string;
  clusterLabel?: string;
  benefitType: string;
  benefitValueBrl: number;
  giftbackBalanceBrl?: number;
  avgTicketBrl?: number;
  minTicketBrl: number;
  freeDishName: string | null;
};

type SlotInfo = {
  id: string;
  starts_at: string;
  capacity: number;
  reserved_count: number;
};

type Props = {
  restaurantId: string;
  restaurantName: string;
  neighborhood: string;
  preferredNeighborhood: string;
  benefit: BenefitInput | null;
  prefersQuietBenefits?: boolean;
  onClose: () => void;
};

export function ReserveConfirmSheet({
  restaurantId,
  restaurantName,
  neighborhood,
  preferredNeighborhood: _preferredNeighborhood,
  benefit,
  prefersQuietBenefits = false,
  onClose,
}: Props) {
  const router = useRouter();
  const [partySize, setPartySize] = useState(2);
  const [applyBenefit, setApplyBenefit] = useState(
    () => !!benefit && benefit.benefitType !== "nenhum" && !prefersQuietBenefits,
  );
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [slot, setSlot] = useState<SlotInfo | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const progressive = useMemo(() => {
    if (!benefit) {
      return progressiveBenefitForParty({
        partySize,
        benefitType: "nenhum",
        benefitValueBrl: 0,
        minTicketBrl: 0,
        freeDishName: null,
      });
    }
    return progressiveBenefitForParty({
      partySize,
      benefitType: benefit.benefitType,
      benefitValueBrl: benefit.benefitValueBrl,
      minTicketBrl: benefit.minTicketBrl,
      freeDishName: benefit.freeDishName,
      avgTicketBrl: benefit.avgTicketBrl,
    });
  }, [benefit, partySize]);

  const checkAvailability = useCallback(
    async (size: number) => {
      setChecking(true);
      setCheckError(null);
      setAvailable(false);
      setSlot(null);
      try {
        // Slots só deste restaurante — evita pegar horário de outro lugar no ranking.
        const res = await fetch(
          `/api/restaurants/${restaurantId}/slots?partySize=${size}`,
        );
        const json = await res.json();
        if (!res.ok) {
          setCheckError(json.error ?? "Não foi possível checar disponibilidade");
          return;
        }

        const foundSlot = (json.nextSlot as SlotInfo | null) ?? null;
        if (!foundSlot) {
          setAvailable(false);
          setCheckError(
            `Sem mesa para ${size} ${size === 1 ? "pessoa" : "pessoas"} neste horário.`,
          );
          return;
        }

        const remaining = foundSlot.capacity - foundSlot.reserved_count;
        if (remaining < size) {
          setAvailable(false);
          setCheckError(
            `Só restam ${remaining} lugares neste horário. Diminua o grupo ou tente outro local.`,
          );
          setSlot(foundSlot);
          return;
        }

        setSlot(foundSlot);
        setAvailable(true);
        setCheckError(null);
      } catch {
        setCheckError("Falha de rede ao checar disponibilidade");
      } finally {
        setChecking(false);
      }
    },
    [restaurantId],
  );

  useEffect(() => {
    void checkAvailability(partySize);
  }, [partySize, checkAvailability]);

  function confirm() {
    if (!slot || !available) return;
    setConfirmError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            slotId: slot.id,
            partySize,
            savePreference: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setConfirmError(json.error ?? "Falha na reserva");
          return;
        }

        const applied: AppliedBenefit =
          applyBenefit && benefit && benefit.benefitType !== "nenhum"
            ? toAppliedBenefit(progressive, true)
            : {
                applied: false,
                benefitType: "nenhum",
                benefitValueBrl: 0,
                minTicketBrl: 0,
                freeDishName: null,
                title: "Sem benefício nesta reserva",
                detail: "Você optou por não aplicar cupom/giftback agora.",
                progressive: true,
                requiredCheckIns: progressive.requiredCheckIns,
                unlocked: false,
              };

        upsertVisit({
          reservationId: json.reservationId,
          restaurantId,
          restaurantName,
          neighborhood,
          cuisine: inferCuisine(restaurantName),
          slotStartsAt: slot.starts_at,
          partySize,
          phase: "preorder",
          lines: [],
          kitchenNotifiedAt: null,
          checkedInAt: null,
          paidAt: null,
          benefit: applied,
          checkIns: [],
          split: null,
        });

        router.push(`/reserva/${json.reservationId}/pre-pedido`);
      } catch {
        setConfirmError("Falha de rede");
      }
    });
  }

  const remaining = slot
    ? Math.max(0, slot.capacity - slot.reserved_count)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label="Confirmar reserva"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-if-lg bg-white p-5 shadow-xl sm:rounded-if-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Confirmar reserva
            </p>
            <h2 className="font-title text-xl font-extrabold text-ink">
              {restaurantName}
            </h2>
            <p className="text-sm text-muted">{neighborhood}</p>
          </div>
          <button
            type="button"
            className="rounded-if px-2 py-1 text-sm font-bold text-muted hover:bg-page"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <label className="mt-5 block">
          <span className="if-label">Quantas pessoas?</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <button
                key={n}
                type="button"
                className={`h-10 min-w-10 rounded-if px-3 text-sm font-extrabold ${
                  partySize === n
                    ? "bg-ifood text-white"
                    : "border border-[var(--ifdl-color-border)] bg-white text-ink"
                }`}
                onClick={() => setPartySize(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </label>

        <div className="mt-4 rounded-if bg-page px-3 py-3">
          <p className="text-[10px] font-bold uppercase text-muted">
            Disponibilidade
          </p>
          {checking ? (
            <p className="mt-1 text-sm font-semibold text-muted">
              Checando mesas para {partySize}…
            </p>
          ) : available && slot ? (
            <div className="mt-1 space-y-1">
              <p className="text-sm font-extrabold text-[var(--ifdl-color-success)]">
                Mesa disponível
              </p>
              <p className="text-xs text-muted">
                Horário{" "}
                {new Date(slot.starts_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                · {remaining}{" "}
                {remaining === 1 ? "lugar restante" : "lugares restantes"}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm font-semibold text-ifood">
              {checkError ?? "Indisponível neste momento"}
            </p>
          )}
          {!checking && (
            <button
              type="button"
              className="mt-2 text-xs font-bold text-ifood underline"
              onClick={() => void checkAvailability(partySize)}
            >
              Atualizar disponibilidade
            </button>
          )}
        </div>

        <div
          className={`mt-4 rounded-if px-3 py-3 ${
            prefersQuietBenefits
              ? "border border-neutral-200 bg-neutral-50"
              : "bg-ifood-soft/70"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">
                Benefício progressivo · {partySize} pessoas
              </p>
              <p
                className={`mt-1 text-sm font-extrabold ${
                  prefersQuietBenefits ? "text-neutral-500" : "text-ifood"
                }`}
              >
                {progressive.title}
              </p>
              <p className="text-[11px] font-semibold text-muted">
                {progressive.detail}
              </p>
              {progressive.progressiveValueBrl > 0 && (
                <p className="mt-1 text-[11px] font-bold text-muted">
                  Base {brl(progressive.baseValueBrl)} → grupo{" "}
                  {brl(progressive.progressiveValueBrl)} (
                  {progressive.multiplier.toFixed(2)}×) · ticket mín.{" "}
                  {brl(progressive.minTicketBrl)}
                </p>
              )}
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-extrabold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--ifdl-color-brand-primary)]"
                checked={applyBenefit}
                disabled={!benefit || benefit.benefitType === "nenhum"}
                onChange={(e) => setApplyBenefit(e.target.checked)}
              />
              Aplicar
            </label>
          </div>
          {prefersQuietBenefits && (
            <p className="mt-2 text-[10px] font-semibold text-amber-700/90">
              Perfil avesso à insistência — benefício opcional e discreto.
            </p>
          )}
        </div>

        {confirmError && (
          <p className="mt-3 text-sm font-semibold text-ifood">{confirmError}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="if-btn-primary flex-1"
            disabled={pending || checking || !available}
            onClick={confirm}
          >
            {pending
              ? "Reservando…"
              : applyBenefit && benefit?.benefitType !== "nenhum"
                ? "Confirmar com benefício"
                : "Confirmar reserva"}
          </button>
          <button
            type="button"
            className="if-btn-secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
