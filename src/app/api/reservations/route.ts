import { NextResponse } from "next/server";
import { reserveInputSchema } from "@/validations/discovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { ensureAnonymousUser } from "@/lib/auth/ensureAnonymous";
import { createReservationFlow } from "@/services/reservation";
import { readJsonBody } from "@/lib/http";
import { checkWriteBudget } from "@/guardrails/rateLimit";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const parsed = reserveInputSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const userClient = await createUserServerClient();
    const user = await ensureAnonymousUser(userClient);
    const admin = createAdminClient();

    if (!(await checkWriteBudget({ admin, sessionId: user.id }))) {
      return NextResponse.json(
        { error: "Limite de requisições atingido", limitReached: true },
        { status: 429 },
      );
    }

    const result = await createReservationFlow(
      userClient,
      admin,
      user.id,
      parsed.data,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
