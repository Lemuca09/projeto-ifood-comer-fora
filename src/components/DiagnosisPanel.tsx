"use client";

import type { DemoBootstrapResult } from "@/services/demoSession";

export function DiagnosisPanel({
  data,
  collapsedDefault = false,
}: {
  data: DemoBootstrapResult;
  collapsedDefault?: boolean;
}) {
  const d = data.diagnosis;

  return (
    <details
      className="if-card group"
      open={!collapsedDefault}
    >
      <summary className="cursor-pointer list-none px-4 py-3 font-title text-base font-extrabold text-ink marker:content-none sm:px-5">
        <span className="flex items-center justify-between gap-2">
          Diagnóstico da IA & métricas de decisão
          <span className="text-xs font-bold text-muted group-open:hidden">
            Expandir
          </span>
          <span className="hidden text-xs font-bold text-muted group-open:inline">
            Recolher
          </span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--ifdl-color-border)] px-4 py-4 sm:px-5">
        {d.silent_mode && (
          <div className="rounded-if border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Modo silencioso</strong> — fadiga {d.fatigue_risk_pct}% (≥
            50%). Evitamos notificação invasiva, mas você ainda pode reservar mesa.
          </div>
        )}
        <p className="text-xs text-muted">
          O diagnóstico é orientação. A reserva no Comer Fora permanece
          disponível.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Índice de fadiga / rejeição"
            value={`${d.fatigue_risk_pct}%`}
            hint="min(100, streak × 25)"
            alert={d.fatigue_risk_pct >= 50}
          />
          <Kpi
            label="Atrito externo"
            value={d.external_friction.toFixed(2)}
            hint="chuva 0.5 + trânsito 0.3 + desloc. 0.2"
            alert={d.external_friction >= 0.55}
          />
          <Kpi
            label="Vantagem financeira"
            value={`R$ ${d.financial_advantage_brl.toFixed(2)}`}
            hint="promo no salão + taxa delivery"
          />
          <Kpi
            label="Tempo economizado"
            value={`${d.time_saved_min} min`}
            hint="ETA delivery − (desloc. + fila)"
            alert={d.time_saved_min <= 0}
          />
        </div>

        <p className="text-sm text-ink">
          <span className="font-bold">Conclusão: </span>
          {d.summary}
        </p>

        <div>
          <p className="if-label">Regras avaliadas</p>
          <ul className="space-y-2">
            {d.rules.map((r) => (
              <li
                key={r.rule_code + r.sort_order}
                className="flex flex-wrap items-start gap-2 rounded-if bg-page px-3 py-2 text-sm"
              >
                <StatusBadge status={r.status} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{r.label}</p>
                  <p className="text-xs text-muted">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi
            label="Elegibilidade da base"
            value={`${data.baseStats.eligibilityRatePct}%`}
            hint={`${data.baseStats.personaCount} personas`}
          />
          <Kpi
            label="Rejeição por fadiga (base)"
            value={`${data.baseStats.avgFatigueRejectionPct}%`}
            hint="modo silencioso na base"
          />
          <Kpi
            label="Uplift estimado ticket"
            value={`R$ ${data.baseStats.estimatedTicketUpliftBrl.toFixed(2)}`}
            hint="média ilustrativa · sintético"
          />
        </div>
      </div>
    </details>
  );
}

function Kpi({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-if border px-3 py-3 ${
        alert
          ? "border-amber-300 bg-amber-50"
          : "border-[var(--ifdl-color-border)] bg-white"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="font-title mt-1 text-2xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
        ✓ Aprovado
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
        Atenção
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
      ✗ Rejeitado
    </span>
  );
}
