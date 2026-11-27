import type { SupabaseClient } from "@supabase/supabase-js";
import { trackEvent } from "@/services/analytics";
import type { ReserveInput } from "@/validations/discovery";

export async function createReservationFlow(
  userClient: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  input: ReserveInput,
) {
  const { data: reservationId, error } = await userClient.rpc(
    "create_reservation",
    {
      p_restaurant_id: input.restaurantId,
      p_slot_id: input.slotId,
      p_party_size: input.partySize,
    },
  );

  if (error || !reservationId) {
    throw new Error(error?.message ?? "Falha ao reservar");
  }

  await trackEvent(admin, {
    userId,
    eventType: "restaurant_select",
    entityId: input.restaurantId,
    metadata: { restaurant_id: input.restaurantId },
  });

  await trackEvent(admin, {
    userId,
    eventType: "reserve",
    entityId: reservationId as string,
    metadata: {
      restaurant_id: input.restaurantId,
      party_size: input.partySize,
      discovery_id: input.discoveryId,
    },
  });

  if (input.savePreference) {
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("neighborhood, price_range")
      .eq("id", input.restaurantId)
      .single();

    await admin.from("saved_preferences").upsert(
      {
        user_id: userId,
        preferred_neighborhood: restaurant?.neighborhood ?? null,
        price_range: restaurant?.price_range ?? null,
        occasion: null,
      },
      { onConflict: "user_id" },
    );

    await trackEvent(admin, {
      userId,
      eventType: "save_preference",
      entityId: userId,
      metadata: { restaurant_id: input.restaurantId },
    });
  }

  const { data: invite, error: invErr } = await admin
    .from("return_invites")
    .insert({
      user_id: userId,
      restaurant_id: input.restaurantId,
      reservation_id: reservationId,
      status: "created",
    })
    .select("id")
    .single();

  if (invErr) {
    console.error("return_invite insert", invErr.code);
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, neighborhood, address, price_range, is_synthetic")
    .eq("id", input.restaurantId)
    .single();

  const { data: slot } = await admin
    .from("restaurant_slots")
    .select("id, starts_at")
    .eq("id", input.slotId)
    .single();

  return {
    reservationId,
    inviteId: invite?.id ?? null,
    restaurant,
    slot,
    partySize: input.partySize,
  };
}
