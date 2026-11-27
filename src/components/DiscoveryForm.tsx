"use client";

import { useEffect, useState, useTransition } from "react";
import { NEIGHBORHOODS, OCCASIONS, PRICE_RANGES } from "@/lib/constants";
import type { DiscoveryResult } from "@/domain/types";
import { RecommendationList } from "@/components/RecommendationList";
import { SessionReset } from "@/components/SessionReset";

type UiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "success"; data: DiscoveryResult }
  | { kind: "error"; message: string }
  | { kind: "fallback_notice"; data: DiscoveryResult; limitReached?: boolean }
  | { kind: "blocked" }
  | { kind: "limit" };

const OCCASION_EMOJI: Record<string, string> = {
  jantar_a_dois: "🥂",
  rapido: "⚡",
  grupo: "🎉",
  familia: "👨‍👩‍👧‍👦",
  especial: "✨",
};

export function DiscoveryForm() {
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0].id);
  const [neighborhood, setNeighborhood] = useState<string>(NEIGHBORHOODS[0]);
  const [partySize, setPartySize] = useState(2);
  const [price, setPrice] = useState<number | "">("");
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void fetch("/api/session", { method: "POST" });
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "loading" });
    startTransition(async () => {
      try {
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occasion,
            neighborhood,
            partySize,
            preferredPriceRange: price === "" ? undefined : price,
            skipAi: true,
          }),
        });
        const json = await res.json();
        if (res.status === 429 || (json.limitReached && !json.items)) {
          setState({ kind: "limit" });
          return;
        }
        if (json.blocked || (res.status === 400 && json.blocked)) {
          setState({ kind: "blocked" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", message: json.error ?? "Falha na descoberta" });
          return;
        }
        const data = json as DiscoveryResult & { limitReached?: boolean };
        if (!data.items?.length) {
          setState({ kind: "empty" });
          return;
        }
        if (data.isFallback || data.limitReached) {
          setState({
            kind: "fallback_notice",
            data,
            limitReached: data.limitReached,
          });
          return;
        }
        setState({ kind: "success", data });
      } catch {
        setState({
          kind: "error",
          message: "Sem conexão ou tempo esgotado. Tente de novo.",
        });
      }
    });
  }

  const resultData =
    state.kind === "success" || state.kind === "fallback_notice"
      ? state.data
      : null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-if-lg bg-gradient-to-r from-ifood to-ifood-dark px-6 py-8 text-white shadow-if lg:px-10 lg:py-10">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Comer Fora
        </p>
        <h1 className="font-title mt-2 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
          Onde comer agora?
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">
          Escolha a ocasião, veja lugares com vaga e reserve na hora.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <form onSubmit={onSubmit} className="space-y-4 lg:sticky lg:top-24">
          <div>
            <p className="if-label">Ocasião</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOccasion(o.id)}
                  className={`if-chip ${occasion === o.id ? "if-chip-active" : ""}`}
                >
                  <span aria-hidden>{OCCASION_EMOJI[o.id] ?? "🍽"}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="if-card space-y-3 p-4 sm:p-5">
            <label className="block">
              <span className="if-label">Bairro</span>
              <select
                className="if-input"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              >
                {NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="if-label">Pessoas</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="if-input"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="if-label">Ticket / pessoa</span>
                <select
                  className="if-input"
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value === "" ? "" : Number(e.target.value))
                  }
                >
                  <option value="">Qualquer faixa</option>
                  {PRICE_RANGES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={pending || state.kind === "loading"}
              className="if-btn-primary w-full"
            >
              {pending || state.kind === "loading"
                ? "Buscando restaurantes…"
                : "Ver opções pra hoje"}
            </button>
            <p className="text-center text-[11px] text-muted">
              Não inclua dados pessoais. Catálogo 100% fictício.
            </p>
          </div>
        </form>

        <div className="space-y-4">
          {state.kind === "error" && (
            <p className="rounded-if border border-ifood/20 bg-ifood-soft px-3 py-2 text-sm text-ifood">
              {state.message}
            </p>
          )}
          {state.kind === "blocked" && (
            <p className="rounded-if border border-ifood/20 bg-ifood-soft px-3 py-2 text-sm text-ifood">
              Pedido bloqueado por segurança. Escolha outra ocasião.
            </p>
          )}
          {state.kind === "limit" && (
            <p className="rounded-if border border-[var(--ifdl-color-border)] bg-white px-3 py-2 text-sm text-muted">
              Limite de uso atingido. Aguarde um minuto.
            </p>
          )}
          {state.kind === "empty" && (
            <div className="if-card p-8 text-center">
              <p className="font-title text-lg font-bold">Nada por aqui agora</p>
              <p className="mt-1 text-sm text-muted">
                Tente outro bairro ou menos pessoas.
              </p>
            </div>
          )}
          {state.kind === "fallback_notice" && (
            <p className="rounded-if border border-[var(--ifdl-color-info)]/30 bg-blue-50 px-3 py-2 text-sm text-[var(--ifdl-color-info)]">
              Modo alternativo: ranking sem IA
              {state.limitReached ? " (limite)" : ""}. Vagas e preços vêm do banco.
            </p>
          )}
          {state.kind === "loading" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="if-card h-56 animate-pulse bg-neutral-100"
                />
              ))}
            </div>
          )}
          {state.kind === "idle" && !resultData && (
            <div className="if-card flex min-h-[220px] items-center justify-center p-8 text-center">
              <div>
                <p className="font-title text-lg font-extrabold text-ink">
                  Pronto quando você estiver
                </p>
                <p className="mt-1 text-sm text-muted">
                  Ajuste os filtros à esquerda e busque opções com vaga.
                </p>
              </div>
            </div>
          )}
          {resultData && (
            <RecommendationList data={resultData} />
          )}
        </div>
      </div>

      <SessionReset />
    </div>
  );
}
