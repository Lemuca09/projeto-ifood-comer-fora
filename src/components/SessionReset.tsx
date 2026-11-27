"use client";

import { useState } from "react";

export function SessionReset() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reset() {
    if (
      !window.confirm(
        "Apagar só os dados desta sessão (reservas, preferências, eventos)?",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/session/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const json = await res.json();
      if (!res.ok) setMsg(json.error ?? "Falha no reset");
      else setMsg("Sessão limpa. Recarregue para começar de novo.");
    } catch {
      setMsg("Falha de rede");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-2 text-center text-sm">
      <button
        type="button"
        disabled={busy}
        onClick={() => void reset()}
        className="font-semibold text-muted underline-offset-2 hover:text-ifood hover:underline disabled:opacity-50"
      >
        {busy ? "Limpando…" : "Resetar minha sessão"}
      </button>
      {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
    </div>
  );
}
