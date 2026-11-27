import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Horários livres de um restaurante (ground truth).
 * Usado pelo ReserveConfirmSheet - não passa pelo ranking/discovery.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const partySize = Math.min(
      20,
      Math.max(1, Number(new URL(request.url).searchParams.get("partySize") ?? 2)),
    );

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const admin = createAdminClient();
    const from = new Date(Date.now() + 15 * 60 * 1000);
    const to = new Date(from.getTime() + 48 * 60 * 60 * 1000);

    const { data: restaurant, error: rErr } = await admin
      .from("restaurants")
      .select("id, name, neighborhood, is_active")
      .eq("id", id)
      .maybeSingle();

    if (rErr) throw rErr;
    if (!restaurant || !restaurant.is_active) {
      return NextResponse.json(
        { error: "Restaurante indisponível", slots: [] },
        { status: 404 },
      );
    }

    const { data: slots, error: sErr } = await admin
      .from("restaurant_slots")
      .select("id, restaurant_id, starts_at, capacity, reserved_count")
      .eq("restaurant_id", id)
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString())
      .order("starts_at", { ascending: true });

    if (sErr) throw sErr;

    const available = (slots ?? []).filter(
      (s) => s.capacity - s.reserved_count >= partySize,
    );

    return NextResponse.json({
      restaurantId: restaurant.id,
      partySize,
      slots: available,
      nextSlot: available[0] ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
