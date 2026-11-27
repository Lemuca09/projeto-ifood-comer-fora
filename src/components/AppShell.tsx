"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { ARCHETYPE_LABELS, type Archetype } from "@/domain/personas";

function navClass(active: boolean) {
  return `rounded-if px-3 py-2 text-sm font-bold ${
    active ? "bg-ifood-soft text-ifood" : "text-muted hover:text-ink"
  }`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const home = pathname === "/";
  const cliente = pathname.startsWith("/cliente");
  const parceiro = pathname.startsWith("/parceiro");
  const metrics = pathname.startsWith("/metricas");
  const { data, setDrawerOpen } = useDemoSession();
  const { regenerate, regenerating } = useAnalyticsDashboard();

  const fatigue = data?.diagnosis.fatigue_risk_pct ?? data?.user.user_fatigue_score;

  return (
    <div className="if-shell pb-20 md:pb-10">
      <header className="if-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-6">
            <div>
              <p className="font-title text-2xl font-extrabold leading-none tracking-tight text-ifood sm:text-[28px]">
                Comer Fora
              </p>
              <p className="mt-1 text-xs text-muted sm:text-sm">
                Delivery → Ocasião Gastronômica
              </p>
            </div>
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
              <Link href="/" className={navClass(home)}>
                Início
              </Link>
              <Link href="/cliente" className={navClass(cliente)}>
                Cliente
              </Link>
              <Link href="/parceiro" className={navClass(parceiro)}>
                Parceiro
              </Link>
              <Link href="/metricas" className={navClass(metrics)}>
                Métricas
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={regenerating}
              className="hidden rounded-if border border-ifood/30 bg-ifood-soft px-3 py-2 text-xs font-extrabold text-ifood transition hover:bg-ifood hover:text-white disabled:opacity-50 sm:inline-flex"
              title="Nova amostra sintética — recalcula KPIs, clusters e gráficos"
            >
              {regenerating ? "Regenerando…" : "Regerar Usuários"}
            </button>
            <span className="synth-badge hidden shrink-0 xl:inline-flex">
              Dados sintéticos
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex max-w-[220px] items-center gap-2 rounded-full border border-[var(--ifdl-color-border)] bg-white py-1.5 pl-1.5 pr-3 text-left shadow-sm transition hover:border-ifood/40"
              aria-label="Abrir perfil da sessão"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ifood text-sm font-extrabold text-white">
                {(data?.user.display_name ?? "U").slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-extrabold text-ink">
                  {data?.user.display_name ?? "Carregando…"}
                </span>
                <span className="block truncate text-[10px] font-semibold text-muted">
                  {data
                    ? ARCHETYPE_LABELS[data.user.archetype as Archetype]
                    : "—"}
                  {typeof fatigue === "number" ? ` · fadiga ${fatigue}%` : ""}
                </span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-10 border-t border-[var(--ifdl-color-border)] pt-4 text-xs leading-relaxed text-muted">
        Projeto de candidato, sem vínculo oficial com o iFood. Dados sintéticos.
        Visual inspirado na linguagem pública da marca; sem logos ou fontes
        proprietárias.
      </footer>

      <nav className="if-bottom-nav" aria-label="Mobile">
        <Link href="/" className={`if-nav-item ${home ? "if-nav-item-active" : ""}`}>
          <span className="text-lg" aria-hidden>
            ⌂
          </span>
          Início
        </Link>
        <Link
          href="/cliente"
          className={`if-nav-item ${cliente ? "if-nav-item-active" : ""}`}
        >
          <span className="text-lg" aria-hidden>
            ♡
          </span>
          Cliente
        </Link>
        <Link
          href="/parceiro"
          className={`if-nav-item ${parceiro ? "if-nav-item-active" : ""}`}
        >
          <span className="text-lg" aria-hidden>
            ▤
          </span>
          Parceiro
        </Link>
        <Link
          href="/metricas"
          className={`if-nav-item ${metrics ? "if-nav-item-active" : ""}`}
        >
          <span className="text-lg" aria-hidden>
            ▦
          </span>
          Métricas
        </Link>
      </nav>

      <ProfileDrawer />
    </div>
  );
}
