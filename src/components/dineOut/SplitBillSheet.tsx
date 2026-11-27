"use client";

import { useMemo, useState } from "react";
import type { CartLine, SplitPaymentState } from "@/domain/dineOut/types";
import {
  buildTableGuests,
  coversTotal,
  expandLines,
  splitByItems,
  splitCustom,
  splitEqual,
  splitInviteUrl,
  sharesTotal,
  type SplitMode,
} from "@/domain/dineOut/splitBill";
import { brl } from "@/components/analytics/format";
import { InviteQr } from "@/components/dineOut/InviteQr";
import Link from "next/link";

type Props = {
  partySize: number;
  lines: CartLine[];
  totalBrl: number;
  discountBrl: number;
  onClose: () => void;
  onConfirm: (state: SplitPaymentState) => void;
};

type InvitePanel = "link" | "qr" | null;

export function SplitBillSheet({
  partySize,
  lines,
  totalBrl,
  discountBrl,
  onClose,
  onConfirm,
}: Props) {
  const payable = Math.max(0, Number((totalBrl - discountBrl).toFixed(2)));
  const guests = useMemo(() => buildTableGuests(partySize), [partySize]);
  const [mode, setMode] = useState<SplitMode>("equal");
  const [selected, setSelected] = useState<string[]>(() =>
    buildTableGuests(partySize).map((g) => g.id),
  );
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [customs, setCustoms] = useState<Record<string, number>>({});
  const [invitePanel, setInvitePanel] = useState<InvitePanel>(null);
  const [copied, setCopied] = useState(false);

  const guestShareBrl = useMemo(() => {
    const n = Math.max(selected.length, 1);
    // Parte típica do convidado (divisão igualitária do total a pagar)
    return Number((payable / n).toFixed(2));
  }, [payable, selected.length]);

  const inviteUrl = useMemo(
    () =>
      splitInviteUrl({
        mesa: `grupo-${partySize}`,
        amountBrl: guestShareBrl,
        payers: selected.length,
        totalBrl: payable,
      }),
    [partySize, guestShareBrl, selected.length, payable],
  );
  const invitePath = useMemo(() => {
    try {
      return new URL(inviteUrl).pathname + new URL(inviteUrl).search;
    } catch {
      return `/split/convidado?mesa=grupo-${partySize}&valor=${guestShareBrl.toFixed(2)}&simulado=1`;
    }
  }, [inviteUrl, partySize, guestShareBrl]);

  const units = useMemo(() => expandLines(lines), [lines]);

  const shares = useMemo(() => {
    if (mode === "equal") return splitEqual(payable, selected);
    if (mode === "by_item") return splitByItems(lines, assignments, selected);
    return splitCustom(customs, selected);
  }, [mode, payable, selected, lines, assignments, customs]);

  const ok = coversTotal(shares, payable);
  const sum = sharesTotal(shares);

  function toggleGuest(id: string) {
    if (id === "titular") return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function confirm() {
    if (!ok) return;
    onConfirm({
      mode,
      guestIds: selected,
      shares: shares.map((s) => ({
        guestId: s.guestId,
        amountBrl: s.amountBrl,
        paid: false,
      })),
      invitedAt: new Date().toISOString(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label="Dividir conta"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-if-lg bg-white p-5 shadow-xl sm:rounded-if-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-muted">
              Split bill · iFood
            </p>
            <h2 className="font-title text-xl font-extrabold">Dividir conta</h2>
            <p className="text-sm text-muted">
              Total a pagar {brl(payable)}
              {discountBrl > 0 ? ` (desconto ${brl(discountBrl)})` : ""}
            </p>
          </div>
          <button
            type="button"
            className="rounded-if px-2 py-1 text-sm font-bold text-muted hover:bg-page"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["equal", "Igualitária"],
              ["by_item", "Por consumo"],
              ["custom", "Personalizado"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-if px-3 py-1.5 text-xs font-extrabold ${
                mode === id
                  ? "bg-ifood text-white"
                  : "border border-[var(--ifdl-color-border)] bg-white text-ink"
              }`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-if bg-page p-3">
          <p className="text-[10px] font-bold uppercase text-muted">
            Convidar da mesa (SIMULADO)
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Compartilhe o link ou mostre o QR para quem está na mesa entrar no
            split pelo app.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={`if-btn-secondary text-xs ${
                invitePanel === "link" ? "border-ifood text-ifood" : ""
              }`}
              onClick={() =>
                setInvitePanel((p) => (p === "link" ? null : "link"))
              }
            >
              Link do convidado
            </button>
            <button
              type="button"
              className={`if-btn-secondary text-xs ${
                invitePanel === "qr" ? "border-ifood text-ifood" : ""
              }`}
              onClick={() => setInvitePanel((p) => (p === "qr" ? null : "qr"))}
            >
              QR Code
            </button>
          </div>

          {invitePanel === "link" && (
            <div className="mt-3 space-y-2 rounded-if border border-[var(--ifdl-color-border)] bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-muted">
                Link de convidado · parte {brl(guestShareBrl)}
              </p>
              <Link
                href={invitePath}
                target="_blank"
                rel="noreferrer"
                className="block break-all rounded-if bg-page px-2 py-2 font-mono text-[11px] font-semibold text-ifood underline"
              >
                {inviteUrl}
              </Link>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="if-btn-primary flex-1 text-xs"
                  onClick={() => void copyLink()}
                >
                  {copied ? "Link copiado!" : "Copiar link"}
                </button>
                <Link
                  href={invitePath}
                  target="_blank"
                  rel="noreferrer"
                  className="if-btn-secondary text-xs"
                >
                  Abrir
                </Link>
              </div>
            </div>
          )}

          {invitePanel === "qr" && (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-if border border-[var(--ifdl-color-border)] bg-white p-4">
              <p className="text-[10px] font-bold uppercase text-muted">
                QR Code · parte {brl(guestShareBrl)}
              </p>
              <InviteQr url={inviteUrl} />
              <p className="text-center text-[11px] text-muted">
                Escaneie ou{" "}
                <Link
                  href={invitePath}
                  target="_blank"
                  className="font-bold text-ifood underline"
                >
                  abra o link do convidado
                </Link>{" "}
                (SIMULADO)
              </p>
            </div>
          )}
        </div>

        <ul className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted">
            Quem vai pagar ({selected.length} de {guests.length})
          </p>
          {guests.map((g) => {
            const on = selected.includes(g.id);
            const share = shares.find((s) => s.guestId === g.id);
            return (
              <li
                key={g.id}
                className={`rounded-if border px-3 py-2 ${
                  on
                    ? "border-ifood/30 bg-ifood-soft/40"
                    : "border-[var(--ifdl-color-border)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex min-w-0 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={g.id === "titular"}
                      onChange={() => toggleGuest(g.id)}
                      className="accent-[var(--ifdl-color-brand-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold">
                        {g.name}
                      </span>
                      <span className="text-[10px] text-muted">{g.handle}</span>
                    </span>
                  </label>
                  {on && mode === "custom" ? (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="if-input w-24 py-1 text-right text-sm"
                      value={customs[g.id] ?? share?.amountBrl ?? 0}
                      onChange={(e) =>
                        setCustoms((prev) => ({
                          ...prev,
                          [g.id]: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    <span className="text-sm font-extrabold text-ifood">
                      {on ? brl(share?.amountBrl ?? 0) : "-"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {mode === "by_item" && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-bold uppercase text-muted">
              Quem consumiu cada item
            </p>
            {units.map((u) => (
              <div
                key={u.key}
                className="flex items-center justify-between gap-2 rounded-if bg-page px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-semibold">
                  {u.name} · {brl(u.unitPriceBrl)}
                </span>
                <select
                  className="rounded-if border border-[var(--ifdl-color-border)] bg-white px-2 py-1 text-xs font-bold"
                  value={assignments[u.key] ?? ""}
                  onChange={(e) =>
                    setAssignments((prev) => ({
                      ...prev,
                      [u.key]: e.target.value,
                    }))
                  }
                >
                  <option value="">-</option>
                  {selected.map((id) => {
                    const g = guests.find((x) => x.id === id);
                    return (
                      <option key={id} value={id}>
                        {g?.name ?? id}
                      </option>
                    );
                  })}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="font-semibold text-muted">Soma das partes</span>
          <span
            className={`font-title font-extrabold ${
              ok ? "text-[var(--ifdl-color-success)]" : "text-ifood"
            }`}
          >
            {brl(sum)} / {brl(payable)}
          </span>
        </div>
        {!ok && (
          <p className="mt-1 text-[11px] font-semibold text-ifood">
            Ajuste até cobrir 100% da conta.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="if-btn-primary flex-1"
            disabled={!ok || selected.length === 0}
            onClick={confirm}
          >
            Enviar cobranças individuais
          </button>
          <button type="button" className="if-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
