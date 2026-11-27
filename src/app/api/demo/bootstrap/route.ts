import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { ensureAnonymousUser } from "@/lib/auth/ensureAnonymous";
import { bootstrapDemoSession } from "@/services/demoSession";
import { assertSameOrigin } from "@/guardrails/csrf";

export async function POST(request: Request) {
  try {
    const origin = assertSameOrigin(request);
    if (!origin.ok) {
      return NextResponse.json({ error: origin.error }, { status: 403 });
    }

    const userClient = await createUserServerClient();
    const user = await ensureAnonymousUser(userClient);
    const admin = createAdminClient();
    const result = await bootstrapDemoSession(admin, user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
