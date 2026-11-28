import { NextResponse } from "next/server";
import { enrichSentiment } from "@/ai/analyticsGemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBody } from "@/lib/http";
import { checkAiBudget, clientIpHmac } from "@/guardrails/rateLimit";
import { inputGuard } from "@/guardrails/inputGuard";
import { sanitizeUserText, stripLikelyPii } from "@/lib/sanitize";
import { z } from "zod";

const schema = z
  .object({
    reviewText: z.string().min(1).max(500),
    useAi: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "texto inválido" }, { status: 400 });
    }

    const cleaned = stripLikelyPii(
      sanitizeUserText(parsed.data.reviewText, 500),
    );
    const guard = inputGuard(cleaned);
    if (guard.decisao === "bloquear") {
      return NextResponse.json(
        { error: "Pedido não pôde ser processado." },
        { status: 400 },
      );
    }

    let useAi =
      parsed.data.useAi === true &&
      guard.decisao !== "degradar";
    if (useAi) {
      const admin = createAdminClient();
      const ip = clientIpHmac(request);
      const budget = await checkAiBudget({
        admin,
        sessionId: `analytics:${ip}`,
        ipHmac: ip,
      });
      if (!budget.allowed) useAi = false;
    }

    const result = await enrichSentiment(guard.textoSeguro, { useAi });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
