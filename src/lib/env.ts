import { z } from "zod";

export {
  NEIGHBORHOODS,
  OCCASIONS,
  REASON_CODES,
  REASON_LABELS,
} from "@/lib/constants";

const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  API_KEY_CLAUDE: z.string().min(1).optional(),
  AI_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  // Em dev, não cacheia — .env pode mudar / HMR sem reiniciar o processo.
  if (cached && process.env.NODE_ENV === "production") return cached;
  const parsed = serverSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL,
    API_KEY_CLAUDE: process.env.API_KEY_CLAUDE,
    AI_ENABLED: process.env.AI_ENABLED,
  });
  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente inválidas: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}
