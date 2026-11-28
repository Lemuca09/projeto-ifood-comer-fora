import { z } from "zod";
import { NEIGHBORHOODS, OCCASIONS } from "@/lib/constants";

export const discoveryInputSchema = z.object({
  occasion: z.enum(
    OCCASIONS.map((o) => o.id) as [string, ...string[]],
  ),
  neighborhood: z.enum(NEIGHBORHOODS),
  partySize: z.number().int().min(1).max(20).default(2),
  preferredPriceRange: z.number().int().min(1).max(4).optional(),
  requestedFor: z.string().datetime().optional(),
  /** Busca conversacional livre (ex.: giftback + ticket). */
  queryText: z.string().max(400).optional(),
  /** Reserva / fluxos internos: ranking local, zero LLM. */
  skipAi: z.boolean().optional(),
  /** Pedido conversacional: gera resposta em texto natural ancorado no banco. */
  conversational: z.boolean().optional(),
  userProfile: z
    .object({
      displayName: z.string().max(80).optional(),
      preferredCuisine: z.string().max(40),
      preferredHourSlot: z.string().max(40),
      priceSensitivity: z.number().min(0).max(1),
      partySizeMode: z.enum(["1", "2", "4+"]),
      favoriteRestaurantId: z.string().uuid().nullable().optional(),
      comerForaVisits90d: z.number().int().min(0).max(500).optional(),
      daysSinceLastDinein: z.number().int().min(0).max(3650).optional(),
    })
    .optional(),
  benefitContext: z
    .object({
      clusterId: z.string().max(40).optional(),
      clusterLabel: z.string().max(80).optional(),
      benefitType: z
        .enum(["cupom", "giftback", "prato_gratis", "nenhum"])
        .optional(),
      benefitValueBrl: z.number().min(0).max(500).optional(),
      giftbackBalanceBrl: z.number().min(0).max(500).optional(),
      avgTicketBrl: z.number().min(0).max(2000).optional(),
      minTicketBrl: z.number().min(0).max(2000).optional(),
      freeDishName: z.string().max(120).optional(),
    })
    .optional(),
});

export type DiscoveryInput = z.infer<typeof discoveryInputSchema>;

export const reserveInputSchema = z.object({
  restaurantId: z.string().uuid(),
  slotId: z.string().uuid(),
  partySize: z.number().int().min(1).max(20),
  discoveryId: z.string().uuid().optional(),
  savePreference: z.boolean().default(true),
});

export type ReserveInput = z.infer<typeof reserveInputSchema>;
