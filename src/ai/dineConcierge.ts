import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";
import { callClaudeText, unwrapJsonText } from "@/ai/claudeClient";
import { CLAUDE_MODEL_RANK } from "@/ai/model";
import { getServerEnv } from "@/lib/env";
import { ABUSE_LIMITS } from "@/guardrails/config";
import { runConciergePreLlm } from "@/guardrails/conciergePreLlm";
import { inferCuisine } from "@/domain/dineOut/menu";
import { progressiveBenefitForParty } from "@/domain/dineOut/progressiveBenefit";
import { cuisineNatural, firstName } from "@/lib/benefitCopy";
import {
  formatSlotLocal,
  nowClockLabel,
  nowLocalLabel,
  partySizeFromMode,
} from "@/lib/dineTime";
import type { EligibleRestaurant } from "@/domain/types";
import type { DiscoveryInput } from "@/validations/discovery";

export { formatSlotLocal, nowClockLabel, nowLocalLabel, partySizeFromMode };

export const CONCIERGE_PROMPT_VERSION = "dine-concierge.v2";

const conciergeSchema = z
  .object({
    answer: z.string().min(20).max(1200),
    primary_restaurant_id: z.string().uuid().nullable(),
    alternative_restaurant_ids: z.array(z.string().uuid()).max(2),
  })
  .strict();

export type GroundRestaurant = {
  id: string;
  nome: string;
  culinaria: string;
  bairro: string;
  faixaPreco: number;
  promoPct: number;
  slotsLivres: string[];
  slotsIso: string[];
  matchCulinaria: boolean;
  vagasProximoSlot: number;
};

export type ConciergeResult = {
  answer: string;
  isFallback: boolean;
  nowLocal: string;
  orderedIds: string[];
  ground: GroundRestaurant[];
  /** Bloqueio da guarda pré-LLM (sem chamar Claude). */
  blockedByGuard?: boolean;
  guardRuleIds?: string[];
};

/** Escapa delimitadores no texto do usuário (AGENTS §7.3). */
function escapeUserDelimiters(text: string): string {
  return text
    .replace(/<\s*\/?\s*user_query\s*>/gi, "")
    .replace(/<\s*\/?\s*system\s*>/gi, "")
    .replace(/<\s*\/?\s*instruction(?:s)?\s*>/gi, "");
}

function loadPrompt(): string {
  return readFileSync(
    path.join(process.cwd(), "src", "ai", "prompts", `${CONCIERGE_PROMPT_VERSION}.md`),
    "utf8",
  );
}

/** Normaliza rótulos de culinária (persona, NER, inferCuisine). */
function normalizeCuisineLabel(raw: string): string {
  const a = raw.trim().toLowerCase();
  if (/japon|sushi|temaki|nikkei/.test(a)) return "japonesa";
  if (/ital|pizza|massa|pasta|nhoque/.test(a)) return "italiana";
  if (/hamb|burger|smash/.test(a)) return "hambúrguer";
  if (/arabe|árabe|esfiha|kibe|shawarma/.test(a)) return "árabe";
  if (
    /veget|vegana|vegano|veggie|\bveg\b|buddha|plant.?based|falafel/.test(a)
  ) {
    return "vegetariana";
  }
  if (/brasil|caseir|feijoada|boteco/.test(a)) return "brasileira";
  return a;
}

function cuisineMatch(preferred: string, restaurantCuisine: string): boolean {
  const a = normalizeCuisineLabel(preferred);
  const b = normalizeCuisineLabel(restaurantCuisine);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Prioriza culinária pedida na pergunta; senão a do perfil. */
function resolveTargetCuisine(
  preferredCuisine: string,
  entityCuisine?: string,
): string {
  if (entityCuisine?.trim()) {
    const mapped = normalizeCuisineLabel(entityCuisine);
    if (mapped === "japonesa") return "Japonesa";
    if (mapped === "italiana") return "Italiana";
    if (mapped === "hambúrguer") return "Hambúrguer";
    if (mapped === "árabe") return "Árabe";
    if (mapped === "vegetariana") return "Vegetariana";
    if (mapped === "brasileira") return "Brasileira";
  }
  return preferredCuisine;
}

function slotNearPreferredHour(iso: string, preferredHourSlot: string): boolean {
  const label = formatSlotLocal(iso);
  const hour = Number(label.split("h")[0]);
  if (!Number.isFinite(hour)) return false;
  const nums = preferredHourSlot.match(/\d{1,2}/g)?.map(Number) ?? [];
  if (nums.length < 2) return true;
  const [start, end] = nums;
  if (start <= end) return hour >= start && hour <= end;
  return hour >= start || hour <= end;
}

export function buildGroundRestaurants(
  candidates: EligibleRestaurant[],
  preferredCuisine: string,
  preferredHourSlot: string,
  limit = ABUSE_LIMITS.maxRankCandidates,
): GroundRestaurant[] {
  const mapped = candidates.map((r) => {
    const culinaria = inferCuisine(r.name);
    const slotsIso = r.slots.slice(0, 4).map((s) => s.starts_at);
    const match = cuisineMatch(preferredCuisine, culinaria);
    const nearHour = slotsIso.some((s) =>
      slotNearPreferredHour(s, preferredHourSlot),
    );
    const promoPct = Number(r.promo_discount_pct ?? 0);
    return {
      id: r.id,
      nome: r.name,
      culinaria,
      bairro: r.neighborhood,
      faixaPreco: r.price_range,
      promoPct,
      slotsLivres: slotsIso.map(formatSlotLocal),
      slotsIso,
      matchCulinaria: match,
      vagasProximoSlot: r.remaining,
      _score:
        (match ? 100 : 0) +
        (nearHour ? 40 : 0) +
        (promoPct > 0 ? 15 : 0) +
        Math.min(r.remaining, 10),
    };
  });

  return mapped
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...rest }) => {
      void _score;
      return rest;
    });
}

function benefitPayload(input: DiscoveryInput, partySize: number) {
  const b = input.benefitContext;
  if (!b || b.benefitType === "nenhum" || !b.benefitType) {
    return { tipo: "nenhum" as const, resumo: "sem benefício ativo" };
  }
  const progressive = progressiveBenefitForParty({
    partySize,
    benefitType: b.benefitType,
    benefitValueBrl: b.benefitValueBrl ?? 0,
    minTicketBrl: b.minTicketBrl ?? 0,
    freeDishName: b.freeDishName ?? null,
    avgTicketBrl: b.avgTicketBrl,
  });
  const valor = progressive.progressiveValueBrl.toFixed(2).replace(".", ",");
  const resumo =
    b.benefitType === "prato_gratis"
      ? `prato grátis${b.freeDishName ? ` de ${b.freeDishName}` : ""}`
      : b.benefitType === "giftback"
        ? `giftback de R$ ${valor}`
        : `cupom de R$ ${valor}`;
  return {
    tipo: b.benefitType,
    valorBrl: progressive.progressiveValueBrl,
    ticketMinBrl: progressive.minTicketBrl,
    pratoGratis: b.freeDishName ?? null,
    resumo,
    detalhe: progressive.detail,
  };
}

function localAnswer(params: {
  ground: GroundRestaurant[];
  preferredCuisine: string;
  nowClock: string;
  displayName?: string;
  benefit: ReturnType<typeof benefitPayload>;
  partySize: number;
}): { answer: string; orderedIds: string[] } {
  const nome = firstName(params.displayName ?? "oi");
  const cuisine = cuisineNatural(params.preferredCuisine);
  const cuisineHits = params.ground.filter((g) => g.matchCulinaria);
  const withPromo = params.ground.filter((g) => g.promoPct > 0);
  const primary = cuisineHits[0] ?? params.ground[0];
  const alts = params.ground
    .filter((g) => g.id !== primary?.id)
    .slice(0, 2);

  if (!primary) {
    return {
      answer: `${nome}, neste horário não encontrei mesas livres perto de você. Que tal tentar de novo em alguns minutos?`,
      orderedIds: [],
    };
  }

  const slot = primary.slotsLivres[0] ?? "em breve";
  let answer: string;

  if (cuisineHits.length === 0) {
    // Não é “culinária sem vaga por padrão”: nenhum elegível no bairro
    // casa com a culinária (slot real existe, mas de outros tipos).
    answer = `${nome}, agora são ${params.nowClock}. Nos lugares com mesa livre agora, não tem opção de ${cuisine} neste bairro. A melhor alternativa com vaga é ${primary.nome} (${primary.culinaria}) às ${slot}.`;
  } else {
    answer = `${nome}, como você curte ${cuisine} e agora são ${params.nowClock}, minha recomendação principal é ${primary.nome} — tem mesa livre às ${slot}.`;
  }

  if (params.benefit.tipo !== "nenhum") {
    const groupBit =
      params.partySize > 1 ? ` para o seu grupo de ${params.partySize}` : "";
    answer += ` No Comer Fora você leva ${params.benefit.resumo}${groupBit}.`;
  }

  if (alts.length) {
    const altBits = alts.map((a) => {
      const t = a.slotsLivres[0] ?? "em breve";
      const promo =
        a.promoPct > 0 ? ` (com ${a.promoPct}% de desconto no salão)` : "";
      return `${a.nome} às ${t}${promo}`;
    });
    answer += ` Se preferir, também olha ${altBits.join(" e ")}.`;
  } else if (withPromo.length && withPromo[0].id !== primary.id) {
    const p = withPromo[0];
    answer += ` Se quiser economizar, ${p.nome} está com ${p.promoPct}% de desconto e vaga às ${p.slotsLivres[0]}.`;
  }

  return {
    answer,
    orderedIds: [primary.id, ...alts.map((a) => a.id)],
  };
}

function clockTokens(label: string): string[] {
  const tokens: string[] = [];
  // Exige "19h" / "19h30" / "19:30" — evita falso positivo em "grupo de 2".
  for (const m of label.matchAll(
    /\b([01]?\d|2[0-3])h([0-5]\d)?\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/gi,
  )) {
    const h = Number(m[1] ?? m[3]);
    const min = m[2] ?? m[4] ?? "00";
    if (!Number.isFinite(h)) continue;
    tokens.push(min === "00" ? `${h}h` : `${h}h${min}`);
  }
  return tokens;
}

function validateAnswerAgainstGround(
  answer: string,
  ground: GroundRestaurant[],
  nowLocal: string,
): boolean {
  const slotTokens = ground.flatMap((g) => g.slotsLivres);
  const allowed = new Set([
    ...slotTokens.map((t) => t.toLowerCase()),
    // Aceita "19h" se existir "19h30" (Claude às vezes arredonda).
    ...slotTokens.map((t) => t.toLowerCase().replace(/h\d{2}$/, "h")),
    ...clockTokens(nowLocal).map((t) => t.toLowerCase()),
    ...clockTokens(nowClockLabel()).map((t) => t.toLowerCase()),
  ]);
  const mentioned = clockTokens(answer);
  for (const token of mentioned) {
    const t = token.toLowerCase();
    if (allowed.has(t)) continue;
    const hourOnly = t.replace(/h\d{2}$/, "h");
    if (allowed.has(hourOnly)) continue;
    return false;
  }
  return true;
}

export async function generateDineConciergeAnswer(params: {
  candidates: EligibleRestaurant[];
  input: DiscoveryInput;
  forceFallback?: boolean;
}): Promise<ConciergeResult> {
  // 1) Pipeline hardcoded — nunca envia bruto ao Claude (AGENTS §7.2).
  const pre = runConciergePreLlm(params.input.queryText);

  const profile = params.input.userProfile;
  const preferredCuisine = resolveTargetCuisine(
    profile?.preferredCuisine ?? "Brasileira",
    pre.entities.cuisine,
  );
  // Se a pergunta cita horário ("20h"), prioriza slots nessa faixa (±1h).
  const preferredHourSlot = (() => {
    const hint = pre.entities.hourHint;
    if (hint) {
      const h = Number(hint.match(/\d{1,2}/)?.[0]);
      if (Number.isFinite(h)) {
        const start = Math.max(0, h - 1);
        const end = Math.min(23, h + 1);
        return `${start}h–${end}h`;
      }
    }
    return profile?.preferredHourSlot ?? "19h–21h";
  })();
  const nowLocal = nowLocalLabel();
  const nowClock = nowClockLabel();
  const ground = buildGroundRestaurants(
    params.candidates,
    preferredCuisine,
    preferredHourSlot,
  );
  const benefit = benefitPayload(params.input, params.input.partySize);
  const local = localAnswer({
    ground,
    preferredCuisine,
    nowClock,
    displayName: profile?.displayName,
    benefit,
    partySize: params.input.partySize,
  });

  if (!pre.allowLlm) {
    return {
      answer: ground.length
        ? `${pre.safeRedirectAnswer} Enquanto isso: ${local.answer}`
        : pre.safeRedirectAnswer,
      isFallback: true,
      nowLocal,
      orderedIds: local.orderedIds,
      ground,
      blockedByGuard: true,
      guardRuleIds: pre.ruleIds,
    };
  }

  const env = getServerEnv();
  if (
    params.forceFallback ||
    !params.input.conversational ||
    !env.AI_ENABLED ||
    !env.API_KEY_CLAUDE ||
    ground.length === 0
  ) {
    return {
      answer: local.answer,
      isFallback: true,
      nowLocal,
      orderedIds: local.orderedIds,
      ground,
    };
  }

  const allowedIds = new Set(ground.map((g) => g.id));
  const safeUserQuery = escapeUserDelimiters(pre.safeQuery);
  // 2) Ground truth + isolamento do user (AGENTS §7.3).
  const payload = {
    agora: nowClock,
    perfil: {
      nome: firstName(profile?.displayName ?? "cliente"),
      culinariaFavorita: preferredCuisine,
      faixaHorarioHabitual: preferredHourSlot,
      sensibilidadePreco: profile?.priceSensitivity ?? 0.5,
      tamanhoMedioGrupo: profile?.partySizeMode ?? String(params.input.partySize),
      visitasComerFora90d: profile?.comerForaVisits90d ?? null,
      diasDesdeUltimaIda: profile?.daysSinceLastDinein ?? null,
      favoritoId: profile?.favoriteRestaurantId ?? null,
    },
    beneficioUsuario: benefit,
    restaurantes: ground.map((g) => ({
      id: g.id,
      nome: g.nome,
      culinaria: g.culinaria,
      bairro: g.bairro,
      faixaPreco: g.faixaPreco,
      promoPct: g.promoPct,
      slotsLivres: g.slotsLivres,
      matchCulinariaFavorita: g.matchCulinaria,
    })),
    entidades: pre.entities,
    NAO_CONFIAVEL: {
      user_query: `<user_query>${safeUserQuery}</user_query>`,
    },
  };

  const system = loadPrompt();
  const text = await callClaudeText({
    system,
    user: JSON.stringify(payload),
    cacheParts: [
      CONCIERGE_PROMPT_VERSION,
      nowLocal.slice(0, 12),
      preferredCuisine,
      params.input.neighborhood,
      params.input.partySize,
      benefit.tipo,
      ground.map((g) => [g.id, g.slotsLivres[0], g.promoPct]),
      pre.safeQuery.slice(0, 80),
    ],
    temperature: 0.35,
    maxTokens: ABUSE_LIMITS.maxOutputTokensConcierge,
    model: CLAUDE_MODEL_RANK,
  });

  if (!text) {
    return {
      answer: local.answer,
      isFallback: true,
      nowLocal,
      orderedIds: local.orderedIds,
      ground,
    };
  }

  try {
    const parsed = conciergeSchema.safeParse(JSON.parse(unwrapJsonText(text)));
    if (!parsed.success) {
      return {
        answer: local.answer,
        isFallback: true,
        nowLocal,
        orderedIds: local.orderedIds,
        ground,
      };
    }

    const primary = parsed.data.primary_restaurant_id;
    const alts = parsed.data.alternative_restaurant_ids.filter(
      (id) => allowedIds.has(id) && id !== primary,
    );
    if (primary && !allowedIds.has(primary)) {
      return {
        answer: local.answer,
        isFallback: true,
        nowLocal,
        orderedIds: local.orderedIds,
        ground,
      };
    }

    if (!validateAnswerAgainstGround(parsed.data.answer, ground, nowLocal)) {
      return {
        answer: local.answer,
        isFallback: true,
        nowLocal,
        orderedIds: local.orderedIds,
        ground,
      };
    }

    const orderedIds = [
      ...(primary ? [primary] : []),
      ...alts,
      ...local.orderedIds.filter(
        (id) => id !== primary && !alts.includes(id),
      ),
    ].slice(0, 3);

    return {
      answer: parsed.data.answer.trim(),
      isFallback: false,
      nowLocal,
      orderedIds,
      ground,
    };
  } catch {
    return {
      answer: local.answer,
      isFallback: true,
      nowLocal,
      orderedIds: local.orderedIds,
      ground,
    };
  }
}
