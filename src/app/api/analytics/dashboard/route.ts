import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAnalyticsDashboard } from "@/services/analyticsEngine";
import { listRestaurants } from "@/services/restaurants";
import type { SyntheticUser } from "@/domain/personas";
import { assertSameOrigin } from "@/guardrails/csrf";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seed = Number(url.searchParams.get("seed") ?? Date.now() % 1_000_000);
    const admin = createAdminClient();
    const [{ data, error }, catalog] = await Promise.all([
      admin.from("synthetic_users").select("*"),
      listRestaurants(admin),
    ]);
    if (error) throw error;
    const dash = buildAnalyticsDashboard(
      (data ?? []) as SyntheticUser[],
      seed,
      catalog,
    );
    return NextResponse.json(dash);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const origin = assertSameOrigin(request);
    if (!origin.ok) {
      return NextResponse.json({ error: origin.error }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { seed?: number };
    const seed = body.seed ?? (Date.now() % 1_000_000);
    const admin = createAdminClient();
    const [{ data, error }, catalog] = await Promise.all([
      admin.from("synthetic_users").select("*"),
      listRestaurants(admin),
    ]);
    if (error) throw error;
    const dash = buildAnalyticsDashboard(
      (data ?? []) as SyntheticUser[],
      seed,
      catalog,
    );
    return NextResponse.json(dash);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
