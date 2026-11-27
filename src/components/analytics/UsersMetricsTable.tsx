"use client";

import { useMemo, useState } from "react";
import type { ClusterId } from "@/domain/analytics/pcaKmeans";
import { CLUSTER_META } from "@/domain/analytics/pcaKmeans";
import type { EnrichedUser } from "@/services/analyticsEngine";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { UserDetailModal } from "@/components/analytics/UserDetailModal";
import { brl, pct } from "@/components/analytics/format";

type SortKey =
  | "display_name"
  | "cluster"
  | "spendDeltaPct"
  | "marginAfter"
  | "churnRisk";

const PAGE_SIZES = [10, 25, 50];

export function UsersMetricsTable() {
  const { dash } = useAnalyticsDashboard();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("spendDeltaPct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [clusterFilter, setClusterFilter] = useState<ClusterId | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<EnrichedUser | null>(null);

  const filtered = useMemo(() => {
    if (!dash) return [];
    let rows = [...dash.users];
    if (clusterFilter !== "all") {
      rows = rows.filter((u) => u.cluster === clusterFilter);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter(
        (u) =>
          u.display_name.toLowerCase().includes(needle) ||
          u.code.toLowerCase().includes(needle),
      );
    }
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });
    return rows;
  }, [dash, clusterFilter, q, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (!dash) return null;

  return (
    <section className="if-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-title text-lg font-extrabold">
            Cada pessoa e a estratégia escolhida
          </h2>
          <p className="mt-1 text-xs text-muted">
            Clique em uma linha para ver o relatório individual (gráficos + copy
            pronta)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-if border border-[var(--ifdl-color-border)] px-3 py-2 text-sm"
            placeholder="Buscar nome ou código"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          <select
            className="rounded-if border border-[var(--ifdl-color-border)] px-3 py-2 text-sm"
            value={clusterFilter}
            onChange={(e) => {
              setClusterFilter(e.target.value as ClusterId | "all");
              setPage(0);
            }}
          >
            <option value="all">Todos os clusters</option>
            {(Object.keys(CLUSTER_META) as ClusterId[]).map((id) => (
              <option key={id} value={id}>
                {CLUSTER_META[id].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--ifdl-color-border)] text-muted">
              <th className="cursor-pointer py-2 pr-2" onClick={() => toggleSort("display_name")}>
                Usuário
              </th>
              <th className="py-2 pr-2">Antes → Depois</th>
              <th className="cursor-pointer py-2 pr-2" onClick={() => toggleSort("cluster")}>
                Cluster
              </th>
              <th className="py-2 pr-2">Estratégia</th>
              <th className="py-2 pr-2">Benefício</th>
              <th className="cursor-pointer py-2 pr-2" onClick={() => toggleSort("spendDeltaPct")}>
                Gasto %
              </th>
              <th className="cursor-pointer py-2 pr-2" onClick={() => toggleSort("marginAfter")}>
                Lucro
              </th>
              <th className="cursor-pointer py-2" onClick={() => toggleSort("churnRisk")}>
                Risco de parar
              </th>
            </tr>
          </thead>
          <tbody>
            {slice.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer border-b border-[var(--ifdl-color-border)] hover:bg-ifood-soft/40"
                onClick={() => setSelected(u)}
              >
                <td className="py-2 pr-2 font-bold">
                  {u.display_name}
                  <span className="block font-semibold text-muted">{u.code}</span>
                </td>
                <td className="py-2 pr-2">
                  {brl(u.spendBefore)} → {brl(u.spendAfter)}
                </td>
                <td className="py-2 pr-2">
                  <span
                    className="rounded-full px-2 py-0.5 font-bold text-white"
                    style={{ background: CLUSTER_META[u.cluster].color }}
                  >
                    {u.clusterLabel}
                  </span>
                </td>
                <td className="max-w-[200px] py-2 pr-2 text-muted">
                  <span className="block truncate font-bold text-ink">{u.strategy}</span>
                  <span className="text-[10px]">
                    retorno est. {u.strategyRoi}x
                  </span>
                </td>
                <td className="py-2 pr-2 font-bold capitalize">
                  {u.benefitType === "prato_gratis"
                    ? `prato: ${u.freeDishName ?? "favorito"}`
                    : u.benefitType}
                  {u.benefitValueBrl > 0 && u.benefitType !== "prato_gratis"
                    ? ` ${brl(u.benefitValueBrl)}`
                    : ""}
                  {u.minTicketBrl > 0 ? (
                    <span className="block text-[10px] font-semibold text-muted">
                      Libera com gastos acima de {brl(u.minTicketBrl)}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-2 font-bold text-ifood">
                  {pct(u.spendDeltaPct)}
                </td>
                <td className="py-2 pr-2">{brl(u.marginAfter)}</td>
                <td className="py-2 font-bold">{u.churnRisk}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-xs font-bold">
          Itens/página
          <select
            className="rounded-if border border-[var(--ifdl-color-border)] px-2 py-1"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">
          Página {safePage + 1} de {pageCount} · {filtered.length} usuários
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-if border border-[var(--ifdl-color-border)] px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="rounded-if border border-[var(--ifdl-color-border)] px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Próximo
          </button>
        </div>
      </div>

      {selected && (
        <UserDetailModal user={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
