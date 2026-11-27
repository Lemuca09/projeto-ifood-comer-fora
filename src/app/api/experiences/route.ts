import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NEIGHBORHOODS } from "@/lib/constants";
import { buildLocalExperienceCards } from "@/services/localExperiences";

/**
 * Vitrine editorial "Descubra a Cidade".
 * Slots e promo do restaurante vêm só do banco — sem inventar benefício.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const neighborhood = searchParams.get("neighborhood") ?? "";
    const partySize = Math.min(
      20,
      Math.max(1, Number(searchParams.get("partySize") ?? 2)),
    );
    const limit = Math.min(
      8,
      Math.max(1, Number(searchParams.get("limit") ?? 6)),
    );

    if (
      !NEIGHBORHOODS.includes(
        neighborhood as (typeof NEIGHBORHOODS)[number],
      )
    ) {
      return NextResponse.json({ error: "Bairro inválido" }, { status: 400 });
    }

    const admin = createAdminClient();
    const experiences = await buildLocalExperienceCards(admin, {
      neighborhood,
      partySize,
      limit,
    });

    return NextResponse.json({
      neighborhood,
      partySize,
      city: "Santos",
      experiences,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
