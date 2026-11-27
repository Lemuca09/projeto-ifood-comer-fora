import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAnalyticsDashboard } from "@/services/analyticsEngine";
import { listRestaurants } from "@/services/restaurants";
import { executiveBrief } from "@/ai/analyticsGemini";
import type { SyntheticUser } from "@/domain/personas";
import { readJsonBody } from "@/lib/http";
import { checkAiBudget, clientIpHmac } from "@/guardrails/rateLimit";
import { z } from "zod";

const schema = z
  .object({
    seed: z.number().int().nonnegative(),
    useAi: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "seed inválido" }, { status: 400 });
    }
    const admin = createAdminClient();
    const [{ data }, catalog] = await Promise.all([
      admin.from("synthetic_users").select("*"),
      listRestaurants(admin),
    ]);
    const dash = buildAnalyticsDashboard(
      (data ?? []) as SyntheticUser[],
      parsed.data.seed,
      catalog,
    );

    let useAi = parsed.data.useAi === true;
    if (useAi) {
      const ip = clientIpHmac(request);
      const budget = await checkAiBudget({
        admin,
        sessionId: `analytics:${ip}`,
        ipHmac: ip,
      });
      if (!budget.allowed) useAi = false;
    }

    const brief = await executiveBrief(dash, { useAi });
    return NextResponse.json(brief);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
