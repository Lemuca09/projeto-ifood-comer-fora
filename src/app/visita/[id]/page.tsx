import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { VisitJourneyClient } from "@/components/dineOut/VisitJourneyClient";

export default async function VisitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userClient = await createUserServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return (
      <div className="if-card space-y-3 p-5">
        <h1 className="font-title text-xl font-extrabold">Sessão necessária</h1>
        <Link href="/" className="if-btn-primary inline-flex">
          Começar de novo
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: reservation } = await admin
    .from("reservations")
    .select("id, party_size, restaurant_id, slot_id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!reservation) {
    return (
      <div className="if-card space-y-3 p-5">
        <h1 className="font-title text-xl font-extrabold">
          Reserva não encontrada
        </h1>
        <Link href="/" className="if-btn-secondary inline-flex">
          Voltar
        </Link>
      </div>
    );
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, neighborhood")
    .eq("id", reservation.restaurant_id)
    .single();

  const { data: slot } = await admin
    .from("restaurant_slots")
    .select("starts_at")
    .eq("id", reservation.slot_id)
    .single();

  return (
    <VisitJourneyClient
      reservationId={reservation.id}
      restaurantId={reservation.restaurant_id}
      restaurantName={restaurant?.name ?? "Restaurante"}
      neighborhood={restaurant?.neighborhood ?? ""}
      slotStartsAt={slot?.starts_at ?? null}
      partySize={reservation.party_size}
    />
  );
}
