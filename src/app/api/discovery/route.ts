import { NextResponse } from "next/server";
import { discoveryInputSchema } from "@/validations/discovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { ensureAnonymousUser } from "@/lib/auth/ensureAnonymous";
import { runDiscovery } from "@/services/discovery";
import { readJsonBody } from "@/lib/http";
import { checkAiBudget, checkWriteBudget, clientIpHmac } from "@/guardrails/rateLimit";
import { secureLog } from "@/guardrails/secureLog";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const parsed = discoveryInputSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const userClient = await createUserServerClient();
    const user = await ensureAnonymousUser(userClient);
    const admin = createAdminClient();

    const writeOk = await checkWriteBudget({ admin, sessionId: user.id });
    if (!writeOk) {
      await secureLog(admin, {
        category: "rate_limit",
        decisao: "bloquear_write",
        sessionId: user.id,
      });
      return NextResponse.json(
        { error: "Limite de requisições atingido. Tente em instantes.", limitReached: true },
        { status: 429 },
      );
    }

    const skipAi = parsed.data.skipAi === true;
    const budget = skipAi
      ? { allowed: false as const, reason: "skip_ai" }
      : await checkAiBudget({
          admin,
          sessionId: user.id,
          ipHmac: clientIpHmac(request),
        });

    const result = await runDiscovery(admin, user.id, parsed.data, {
      forceFallback: skipAi || !budget.allowed,
    });

    if (!skipAi && !budget.allowed) {
      await secureLog(admin, {
        category: "rate_limit",
        decisao: budget.reason ?? "ai_budget",
        sessionId: user.id,
      });
    }

    // Ocasião bloqueada sem resposta conversacional → 400.
    // Concierge fora de escopo → 200 com blocked + mensagem (sem cards / sem LLM).
    if (result.blocked && !result.answer) {
      return NextResponse.json(
        { error: "Pedido não pôde ser processado. Tente outra ocasião.", blocked: true },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...result,
      limitReached: !skipAi && !budget.allowed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
