import { z } from "zod";
import { REASON_CODES } from "@/lib/constants";

export const aiRecommendationSchema = z
  .object({
    recommendations: z
      .array(
        z
          .object({
            restaurant_id: z.string().uuid(),
            codigoMotivo: z.enum(REASON_CODES),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

export type AiRecommendationPayload = z.infer<typeof aiRecommendationSchema>;
