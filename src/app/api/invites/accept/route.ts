import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { ensureAnonymousUser } from "@/lib/auth/ensureAnonymous";
import { readJsonBody } from "@/lib/http";

const schema = z.object({ inviteId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const userClient = await createUserServerClient();
    const user = await ensureAnonymousUser(userClient);
    const admin = createAdminClient();

    const { data: invite } = await admin
      .from("return_invites")
      .select("id, user_id")
      .eq("id", parsed.data.inviteId)
      .maybeSingle();

    if (!invite || invite.user_id !== user.id) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    await admin
      .from("return_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    return NextResponse.json({ status: "accepted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
