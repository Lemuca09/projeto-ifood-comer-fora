import { createAdminClient } from "@/lib/supabase/admin";
import { PresenterGate } from "@/components/PresenterGate";

export const dynamic = "force-dynamic";

/**
 * Painel só para o apresentador (AGENTS §8).
 * Protegido por PRESENTER_TOKEN no servidor - sem expor regras/scores ao público.
 */
export default async function ApresentadorPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const expected = process.env.PRESENTER_TOKEN;
  if (!expected || token !== expected) {
    return <PresenterGate />;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("security_audit")
    .select("id, category, decisao, rule_ids, score, versao, latencia_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Auditoria (apresentador)</h1>
      <p className="text-sm text-ink/60">
        Allowlist: sem texto bruto, prompt, canary, IP ou segredo. Risco residual
        permanece - o sistema não é à prova de jailbreak.
      </p>
      <ul className="space-y-2 text-xs font-mono">
        {(data ?? []).map((row) => (
          <li key={row.id} className="border border-ink/10 bg-paper/70 px-2 py-2">
            {row.created_at} · {row.category} · {row.decisao} · score=
            {row.score ?? "-"} · rules=
            {(row.rule_ids ?? []).join(",") || "-"} · {row.versao ?? "-"} ·{" "}
            {row.latencia_ms ?? "-"}ms
          </li>
        ))}
        {!data?.length && <li>Sem eventos ainda (ou migration 005 não aplicada).</li>}
      </ul>
    </div>
  );
}
