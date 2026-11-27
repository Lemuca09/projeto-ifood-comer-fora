import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/http";
import { checkWriteBudget } from "@/guardrails/rateLimit";

const schema = z.object({ confirm: z.literal(true) });

/**
 * Reset idempotente só da sessão atual (AGENTS §4).
 * Não apaga catálogo/seed. Confirmação obrigatória + rate limit.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Confirme com { confirm: true }" },
        { status: 400 },
      );
    }

    const userClient = await createUserServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: true, note: "sem sessão" });
    }

    const admin = createAdminClient();
    if (!(await checkWriteBudget({ admin, sessionId: user.id }))) {
      return NextResponse.json({ error: "Limite atingido" }, { status: 429 });
    }

    // Cancela reservas ativas da sessão (libera capacidade)
    const { data: open } = await admin
      .from("reservations")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "confirmed");

    for (const r of open ?? []) {
      await userClient.rpc("cancel_reservation", { p_reservation_id: r.id });
    }

    await admin.from("return_invites").delete().eq("user_id", user.id);
    await admin.from("saved_preferences").delete().eq("user_id", user.id);
    await admin.from("app_events").delete().eq("user_id", user.id);

    // discovery/recommendations: cascade via discovery_requests
    const { data: discs } = await admin
      .from("discovery_requests")
      .select("id")
      .eq("user_id", user.id);
    const ids = (discs ?? []).map((d) => d.id);
    if (ids.length) {
      await admin.from("discovery_requests").delete().in("id", ids);
    }

    await userClient.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
