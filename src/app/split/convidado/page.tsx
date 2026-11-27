"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { brl } from "@/components/analytics/format";

function ConvidadoContent() {
  const params = useSearchParams();
  const mesa = params.get("mesa") ?? "mesa";
  const [paid, setPaid] = useState(false);

  const share = useMemo(() => {
    const raw = params.get("valor");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
  }, [params]);

  const total = useMemo(() => {
    const raw = params.get("total");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null;
  }, [params]);

  const payers = useMemo(() => {
    const raw = params.get("pagantes");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }, [params]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="overflow-hidden rounded-if-lg bg-gradient-to-br from-ifood to-ifood-dark px-5 py-6 text-white shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Split bill · convidado
        </p>
        <h1 className="font-title mt-1 text-2xl font-extrabold">
          Sua parte da conta
        </h1>
        <p className="mt-2 text-sm text-white/90">
          Mesa <strong>{mesa}</strong> · experiência SIMULADA no Comer Fora
        </p>
      </section>

      <section className="if-card space-y-3 p-5">
        {share == null ? (
          <p className="text-sm font-semibold text-ifood">
            Este link não trouxe o valor a pagar. Peça um novo convite ao
            titular da comanda.
          </p>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase text-muted">
              Quanto você paga
            </p>
            <p className="font-title text-3xl font-extrabold text-ifood">
              {brl(share)}
            </p>
            {(total != null || payers != null) && (
              <p className="text-xs text-muted">
                {total != null ? `Conta total ${brl(total)}` : null}
                {total != null && payers != null ? " · " : null}
                {payers != null
                  ? `${payers} ${payers === 1 ? "pagante" : "pagantes"}`
                  : null}
              </p>
            )}
            {!paid ? (
              <button
                type="button"
                className="if-btn-primary w-full"
                onClick={() => setPaid(true)}
              >
                Pagar {brl(share)} no iFood (SIMULADO)
              </button>
            ) : (
              <div className="rounded-if border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
                Pagamento SIMULADO de {brl(share)} confirmado. Obrigado!
              </div>
            )}
          </>
        )}
      </section>

      <Link href="/" className="if-btn-secondary inline-flex">
        Voltar ao início
      </Link>
    </div>
  );
}

export default function SplitConvidadoPage() {
  return (
    <Suspense
      fallback={
        <div className="if-card p-6 text-center text-sm text-muted">
          Carregando convite…
        </div>
      }
    >
      <ConvidadoContent />
    </Suspense>
  );
}
