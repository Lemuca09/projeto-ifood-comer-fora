import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRestaurants } from "@/services/restaurants";
import { NEIGHBORHOODS } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const neighborhood = searchParams.get("neighborhood") ?? undefined;
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    if (
      neighborhood &&
      !NEIGHBORHOODS.includes(
        neighborhood as (typeof NEIGHBORHOODS)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Bairro inválido" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const restaurants = await listRestaurants(admin, {
      neighborhood,
      limit:
        typeof limit === "number" && Number.isFinite(limit)
          ? Math.min(Math.max(limit, 1), 80)
          : undefined,
    });

    return NextResponse.json({ restaurants });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
