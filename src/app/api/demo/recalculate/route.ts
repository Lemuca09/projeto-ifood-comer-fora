import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { ensureAnonymousUser } from "@/lib/auth/ensureAnonymous";
import { updateSessionAndRecalculate } from "@/services/demoSession";
import { readJsonBody } from "@/lib/http";
import { recalculateSchema } from "@/validations/demo";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    const parsed = recalculateSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const userClient = await createUserServerClient();
    const user = await ensureAnonymousUser(userClient);
    const admin = createAdminClient();

    const result = await updateSessionAndRecalculate(admin, user.id, {
      syntheticUserId: parsed.data.syntheticUserId,
      metrics: parsed.data.metrics,
      userOverrides: {
        user_push_ignored_streak: parsed.data.user_push_ignored_streak,
        user_fatigue_score: parsed.data.user_fatigue_score,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
