"use client";

import { useEffect, useState } from "react";

export function InviteClient({
  inviteId,
  initialStatus,
}: {
  inviteId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status !== "created") return;
    void fetch("/api/invites/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    }).then(async (res) => {
      if (res.ok) setStatus("viewed");
    });
  }, [inviteId, status]);

  async function accept() {
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    if (res.ok) setStatus("accepted");
  }

  return (
    <div className="if-card border-ifood/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-title text-lg font-extrabold">Volte e ganhe</h2>
        <span className="synth-badge">SIMULADO</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        SMS/e-mail inexistente (SIMULADO). Preferência salva só nesta sessão do
        app.
      </p>
      <p className="mt-2 text-xs font-semibold text-muted">Status: {status}</p>
      {status !== "accepted" && (
        <button
          type="button"
          onClick={() => void accept()}
          className="if-btn-primary mt-3 w-full"
        >
          Aceitar convite
        </button>
      )}
    </div>
  );
}
