import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFunnelMetrics } from "@/services/analytics";

export async function GET() {
  try {
    const admin = createAdminClient();
    const metrics = await getFunnelMetrics(admin);
    return NextResponse.json({
      ...metrics,
      note: "Números de uso ao vivo no app de demonstração. Seed/catálogo é sintético; não é resultado de mercado.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
