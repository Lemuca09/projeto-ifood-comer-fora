"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { EnrichedUser } from "@/services/analyticsEngine";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { brl } from "@/components/analytics/format";
import { notificationCopy } from "@/lib/benefitCopy";

type CopyPayload = {
  diagnostico: string;
  pushCopy: string;
  isFallback: boolean;
};

function localCopy(user: EnrichedUser): CopyPayload {
  return {
    diagnostico: `${user.clusterLabel}: a melhor opção agora é "${user.strategy}". ${user.strategyReason}`,
    pushCopy: notificationCopy({
      displayName: user.display_name,
      cuisine: user.cuisine,
      preferredHour: user.preferredHour,
      benefitType: user.benefitType,
      benefitValueBrl: user.benefitValueBrl,
      minTicketBrl: user.minTicketBrl,
      freeDishName: user.freeDishName,
    }),
    isFallback: true,
  };
}

export function UserDetailModal({
  user,
  onClose,
}: {
  user: EnrichedUser;
  onClose: () => void;
}) {
  const { dash } = useAnalyticsDashboard();
  const base = useMemo(() => localCopy(user), [user]);
  const [copy, setCopy] = useState<CopyPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const shown = copy ?? base;

  useEffect(() => {
    setCopy(null);
    setCopied(false);
  }, [user.id]);

  if (!dash) return null;

  function generateWithAi() {
    startTransition(async () => {
      const res = await fetch("/api/analytics/gemini/user-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: dash!.seed,
          userId: user.id,
          useAi: true,
        }),
      });
      const j = await res.json();
      if (res.ok) setCopy(j as CopyPayload);
    });
  }

  const beforeAfter = [
    { metric: "Gasto", antes: user.spendBefore, depois: user.spendAfter },
    {
      metric: "Frequência",
      antes: user.frequency * 0.85,
      depois: user.frequency,
    },
    { metric: "Margem", antes: user.marginBefore, depois: user.marginAfter },
  ];

  const peers = dash.users
    .filter((u) => u.cluster === user.cluster)
    .map((u) => ({
      x: u.pcaX,
      y: u.pcaY,
      me: u.id === user.id ? 1 : 0,
    }));

  const contrib = dash.regression.featureNames.map((name, i) => {
    const beta = dash.regression.betas[i];
    const raw =
      name === "frequencia"
        ? user.frequency
        : name === "taxa_cupom"
          ? user.couponRate
          : name === "recencia_dias"
            ? user.recencyDays
            : name === "risco_churn"
              ? user.churnRisk
              : name === "beneficio_brl"
                ? user.benefitValueBrl
                : name === "sensibilidade_preco"
                  ? user.priceSensitivity * 100
                  : name === "visitas_comer_fora"
                    ? user.comerForaVisits90d
                    : name === "nps"
                      ? user.lastNpsScore
                      : user.benefitValueBrl;
    return { name, impact: Number((beta * (raw / 100)).toFixed(3)) };
  });

  const hours = ["12h–14h", "19h–20h", "20h–21h30", "21h30–23h"].map((h) => ({
    h,
    v: h === user.preferredHour ? 8 + (user.frequency % 5) : 1 + (user.code.length % 3),
  }));

  async function copyPush() {
    await navigator.clipboard.writeText(shown.pushCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label={`Relatório de ${user.display_name}`}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-if-lg bg-white p-4 shadow-xl sm:rounded-if-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-muted">{user.code}</p>
            <h2 className="font-title text-xl font-extrabold">
              {user.display_name}
            </h2>
            <p className="text-sm text-muted">
              {user.clusterLabel} · retorno est. {user.strategyRoi}x
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{user.strategy}</p>
            <p className="mt-1 text-xs text-muted">{user.strategyReason}</p>
            {user.minTicketBrl > 0 && (
              <p className="mt-1 text-xs font-bold text-ifood">
                Libera com gastos acima de {brl(user.minTicketBrl)}
                {user.freeDishName ? ` · prato: ${user.freeDishName}` : ""}
              </p>
            )}
            {user.favoriteDishes?.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                Mais pedidos:{" "}
                {user.favoriteDishes
                  .map((d) => `${d.name} (${d.purchaseSharePct}%)`)
                  .join(" · ")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                {user.cuisine}
              </span>
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                {user.preferredHour}
              </span>
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                sens. preço {(user.priceSensitivity * 100).toFixed(0)}%
              </span>
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                cupom 90d {(user.couponRate * 100).toFixed(0)}%
              </span>
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                mesa {user.partySizeMode}
              </span>
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                CF {user.comerForaVisits90d} visitas
              </span>
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                Prob. recomendação {user.lastNpsScore}
              </span>
              <span className="rounded-full bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                margem {user.avgMarginPct}%
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-if px-3 py-1 text-sm font-bold text-muted hover:bg-page"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-if border border-[var(--ifdl-color-border)] p-3">
            <h3 className="text-sm font-extrabold">Antes vs Depois</h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={beforeAfter}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="antes" fill="#a3a3a3" radius={3} />
                  <Bar dataKey="depois" fill="#ea1d2c" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-if border border-[var(--ifdl-color-border)] p-3">
            <h3 className="text-sm font-extrabold">
              Onde está vs. o próprio grupo
            </h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" dataKey="x" name="PC1" tick={{ fontSize: 10 }} />
                  <YAxis type="number" dataKey="y" name="PC2" tick={{ fontSize: 10 }} />
                  <ZAxis range={[40, 160]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter
                    data={peers.filter((p) => !p.me)}
                    fill="#c4c4c4"
                  />
                  <Scatter
                    data={peers.filter((p) => p.me)}
                    fill="#ea1d2c"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-if border border-[var(--ifdl-color-border)] p-3">
            <h3 className="text-sm font-extrabold">
              Contribuição na regressão
            </h3>
            <ul className="mt-2 space-y-1 text-xs">
              {contrib
                .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
                .map((c) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span>{c.name}</span>
                    <span
                      className={
                        c.impact >= 0
                          ? "font-bold text-[var(--ifdl-color-success)]"
                          : "font-bold text-ifood"
                      }
                    >
                      {c.impact >= 0 ? "+" : ""}
                      {c.impact}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-if border border-[var(--ifdl-color-border)] p-3">
            <h3 className="text-sm font-extrabold">
              Sazonalidade individual
            </h3>
            <p className="mt-1 text-xs text-muted">
              Culinária favorita: {user.cuisine}
            </p>
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours}>
                  <XAxis dataKey="h" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Bar dataKey="v" fill="#f5a623" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-if bg-ifood-soft/50 p-4">
          <h3 className="font-title text-sm font-extrabold">
            Notificação personalizada
          </h3>
          <p className="mt-2 text-sm">
            <span className="font-bold">Por que essa estratégia:</span>{" "}
            {shown.diagnostico}
          </p>
          <p className="mt-2 text-sm leading-relaxed">{shown.pushCopy}</p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted">
            {shown.isFallback ? "Local (0 RPM)" : "Claude"} ·{" "}
            {user.benefitType === "nenhum"
              ? "sem desconto por agora"
              : user.benefitType === "prato_gratis"
                ? `prato grátis (${user.freeDishName})${
                    user.minTicketBrl > 0
                      ? ` · libera com gastos acima de ${brl(user.minTicketBrl)}`
                      : ""
                  }`
                : `${user.benefitType} ${brl(user.benefitValueBrl)}${
                    user.minTicketBrl > 0
                      ? ` · libera com gastos acima de ${brl(user.minTicketBrl)}`
                      : ""
                  }`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="if-btn-primary"
              onClick={() => void copyPush()}
            >
              {copied ? "Copiado!" : "Copiar notificação"}
            </button>
            <button
              type="button"
              className="rounded-if border border-ifood/30 bg-white px-3 py-2 text-xs font-extrabold text-ifood disabled:opacity-50"
              disabled={pending}
              onClick={generateWithAi}
            >
              {pending ? "Gerando…" : "Gerar com Claude"}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-if border border-[var(--ifdl-color-border)] p-3 text-xs">
          <p className="font-bold">Sentimento / causa raiz</p>
          <p className="mt-1 text-muted">&ldquo;{user.reviewText}&rdquo;</p>
          <p className="mt-1">
            Sentimento {user.sentiment} · Prob. recomendação{" "}
            {user.lastNpsScore} · atrito:{" "}
            {user.frictionReason} · risco de parar {user.churnRisk}%
          </p>
          <p className="mt-1 text-muted">
            Margem lifetime {brl(user.lifetimeMarginBrl)} · média{" "}
            {user.avgMarginPct}%
            {user.favoriteRestaurantId
              ? ` · favorito ${user.favoriteRestaurantId.slice(0, 8)}…`
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
