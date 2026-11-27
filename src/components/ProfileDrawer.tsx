"use client";

import { useEffect, useState } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { ARCHETYPE_LABELS, type Archetype } from "@/domain/personas";
import type { DemoSessionMetrics } from "@/domain/personas";

export function ProfileDrawer() {
  const { data, drawerOpen, setDrawerOpen, recalculate, recalculating } =
    useDemoSession();
  const [userId, setUserId] = useState("");
  const [metrics, setMetrics] = useState<DemoSessionMetrics | null>(null);
  const [streak, setStreak] = useState(0);
  const [fatigue, setFatigue] = useState(0);

  useEffect(() => {
    if (!data) return;
    setUserId(data.user.id);
    setMetrics({ ...data.metrics });
    setStreak(data.user.user_push_ignored_streak);
    setFatigue(data.user.user_fatigue_score);
  }, [data, drawerOpen]);

  if (!drawerOpen || !data || !metrics) return null;

  function set<K extends keyof DemoSessionMetrics>(key: K, value: DemoSessionMetrics[K]) {
    setMetrics((m) => (m ? { ...m, [key]: value } : m));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-if">
        <div className="flex items-center justify-between border-b border-[var(--ifdl-color-border)] px-4 py-3">
          <h2 className="font-title text-lg font-extrabold">Perfil da sessão</h2>
          <button
            type="button"
            className="text-sm font-bold text-muted"
            onClick={() => setDrawerOpen(false)}
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <label className="block">
            <span className="if-label">Persona sintética</span>
            <select
              className="if-input"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                const u = data.allUsers.find((x) => x.id === e.target.value);
                if (u) {
                  setStreak(u.user_push_ignored_streak);
                  setFatigue(u.user_fatigue_score);
                }
              }}
            >
              {data.allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name} ·{" "}
                  {ARCHETYPE_LABELS[u.archetype as Archetype] ?? u.archetype}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Notificações ignoradas (streak)"
            value={streak}
            min={0}
            max={6}
            onChange={setStreak}
          />
          <Field
            label="Score de fadiga"
            value={fatigue}
            min={0}
            max={100}
            onChange={setFatigue}
          />
          <Field
            label="Subtotal do carrinho (R$)"
            value={metrics.cart_subtotal_brl}
            min={0}
            max={500}
            step={1}
            onChange={(v) => set("cart_subtotal_brl", v)}
          />
          <Field
            label="Taxa de delivery (R$)"
            value={metrics.cart_delivery_fee_brl}
            min={0}
            max={40}
            step={0.5}
            onChange={(v) => set("cart_delivery_fee_brl", v)}
          />
          <Field
            label="ETA delivery (min)"
            value={metrics.cart_delivery_eta_min}
            min={5}
            max={90}
            onChange={(v) => set("cart_delivery_eta_min", v)}
          />
          <Field
            label="Distância (km)"
            value={metrics.dist_to_restaurant_km}
            min={0}
            max={15}
            step={0.1}
            onChange={(v) => set("dist_to_restaurant_km", v)}
          />
          <Field
            label="Tempo de deslocamento (min)"
            value={metrics.travel_time_min}
            min={1}
            max={60}
            onChange={(v) => set("travel_time_min", v)}
          />
          <Field
            label="Fila no restaurante (min)"
            value={metrics.rest_current_wait_min}
            min={0}
            max={60}
            onChange={(v) => set("rest_current_wait_min", v)}
          />
          <Field
            label="Chuva (%)"
            value={metrics.ext_rain_probability_pct}
            min={0}
            max={100}
            onChange={(v) => set("ext_rain_probability_pct", v)}
          />
          <Field
            label="Trânsito (0–1)"
            value={metrics.ext_traffic_congestion_idx}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => set("ext_traffic_congestion_idx", v)}
          />
          <Field
            label="Desconto promo salão (%)"
            value={metrics.rest_active_promo_discount_pct}
            min={0}
            max={50}
            step={1}
            onChange={(v) => set("rest_active_promo_discount_pct", v)}
          />
          <Field
            label="Ociosidade do salão (%)"
            value={metrics.rest_idle_capacity_pct}
            min={0}
            max={100}
            onChange={(v) => set("rest_idle_capacity_pct", v)}
          />
          <Field
            label="Hesitação na tela (seg)"
            value={metrics.session_hesitation_sec}
            min={0}
            max={300}
            onChange={(v) => set("session_hesitation_sec", v)}
          />
        </div>

        <div className="border-t border-[var(--ifdl-color-border)] p-4">
          <button
            type="button"
            className="if-btn-primary w-full"
            disabled={recalculating}
            onClick={() =>
              void recalculate({
                syntheticUserId: userId,
                metrics,
                user_push_ignored_streak: streak,
                user_fatigue_score: fatigue,
              })
            }
          >
            {recalculating
              ? "Reavaliando contexto…"
              : "Salvar e recalcular"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="if-label">
        {label}: <span className="text-ink">{value}</span>
      </span>
      <input
        type="range"
        className="w-full accent-[var(--ifdl-color-brand-primary)]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
