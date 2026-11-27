import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserServerClient } from "@/lib/supabase/server";
import { InviteClient } from "@/components/InviteClient";

export default async function ConfirmacaoPage({
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
    .select("id, party_size, status, restaurant_id, slot_id, user_id")
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
    .select("name, neighborhood, address, is_synthetic")
    .eq("id", reservation.restaurant_id)
    .single();

  const { data: slot } = await admin
    .from("restaurant_slots")
    .select("starts_at")
    .eq("id", reservation.slot_id)
    .single();

  const { data: invite } = await admin
    .from("return_invites")
    .select("id, status")
    .eq("reservation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-if-lg bg-[var(--ifdl-color-success)] px-6 py-6 text-white shadow-if">
        <p className="text-xs font-bold uppercase tracking-wider text-white/85">
          Pedido no salão
        </p>
        <h1 className="font-title mt-1 text-3xl font-extrabold">
          Reserva confirmada
        </h1>
        <p className="mt-1 text-sm text-white/90">Status: {reservation.status}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="if-card p-5">
          <span className="synth-badge">Dados sintéticos</span>
          <p className="font-title mt-3 text-xl font-extrabold text-ink">
            {restaurant?.name}
          </p>
          <p className="mt-1 text-sm text-muted">
            {restaurant?.neighborhood} · {restaurant?.address}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-if bg-page p-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted">Pessoas</p>
              <p className="font-bold">{reservation.party_size}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Horário</p>
              <p className="font-bold">
                {slot
                  ? new Date(slot.starts_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "-"}
              </p>
            </div>
          </div>
        </div>

        {invite && (
          <InviteClient inviteId={invite.id} initialStatus={invite.status} />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/reserva/${id}/pre-pedido`}
          className="if-btn-primary inline-flex"
        >
          Pedido antecipado
        </Link>
        <Link href={`/visita/${id}`} className="if-btn-secondary inline-flex">
          Ir à visita / check-in
        </Link>
        <Link href="/" className="if-btn-secondary inline-flex">
          Nova busca
        </Link>
      </div>
    </div>
  );
}
