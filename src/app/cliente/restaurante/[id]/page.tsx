import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurantById } from "@/services/restaurants";
import { RestaurantDetailClient } from "@/components/dineOut/RestaurantDetailClient";

export default async function ClienteRestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab = tab === "comer-fora" ? "comer-fora" : "delivery";

  const admin = createAdminClient();
  const restaurant = await getRestaurantById(admin, id);

  if (!restaurant) {
    return (
      <div className="if-card mx-auto max-w-lg space-y-3 p-6 text-center">
        <h1 className="font-title text-xl font-extrabold">
          Restaurante não encontrado
        </h1>
        <p className="text-sm text-muted">
          O registro não existe no catálogo ativo do banco.
        </p>
        <Link href="/cliente" className="if-btn-primary inline-flex">
          Voltar ao Cliente
        </Link>
      </div>
    );
  }

  return (
    <RestaurantDetailClient restaurant={restaurant} initialTab={initialTab} />
  );
}
