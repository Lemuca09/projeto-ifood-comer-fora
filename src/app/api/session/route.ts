import { NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";
import { ensureAnonymousUser } from "@/lib/auth/ensureAnonymous";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackEvent } from "@/services/analytics";
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
    await trackEvent(admin, {
      userId: user.id,
      eventType: "view",
      entityId: null,
      metadata: {},
    });
    return NextResponse.json({ userId: user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
