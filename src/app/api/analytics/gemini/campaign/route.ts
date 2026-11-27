import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAnalyticsDashboard } from "@/services/analyticsEngine";
import { restaurantCampaignPlan } from "@/ai/analyticsGemini";
import type { SyntheticUser } from "@/domain/personas";
import { readJsonBody } from "@/lib/http";
import { checkAiBudget, clientIpHmac } from "@/guardrails/rateLimit";
import { z } from "zod";

const schema = z
  .object({
    seed: z.number().int().nonnegative(),
    neighborhood: z.string().min(1).max(80),
    useAi: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data } = await admin.from("synthetic_users").select("*");
    const dash = buildAnalyticsDashboard((data ?? []) as SyntheticUser[], parsed.data.seed);

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

    const plan = await restaurantCampaignPlan(dash, parsed.data.neighborhood, {
      useAi,
    });
    return NextResponse.json(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
