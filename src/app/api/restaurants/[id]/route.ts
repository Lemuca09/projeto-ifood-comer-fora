import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurantById } from "@/services/restaurants";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const admin = createAdminClient();
    const restaurant = await getRestaurantById(admin, id);
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ restaurant });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
