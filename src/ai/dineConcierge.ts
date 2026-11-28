import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";
import {
  callClaudeText,
  consumeClaudeFailReason,
  unwrapJsonText,
} from "@/ai/claudeClient";
import { CLAUDE_MODEL_FAST } from "@/ai/model";
import { getServerEnv } from "@/lib/env";
import { ABUSE_LIMITS } from "@/guardrails/config";
import {
  CONCIERGE_INTENT_LABELS,
  runConciergePreLlm,
  type ConciergeIntent,
} from "@/guardrails/conciergePreLlm";
import { rawModelTextSafe } from "@/guardrails/textSafety";
import { inferCuisine } from "@/domain/dineOut/menu";
import { progressiveBenefitForParty } from "@/domain/dineOut/progressiveBenefit";
import { cuisineNatural, firstName } from "@/lib/benefitCopy";
import {
  formatSlotLocal,
  formatSlotWhen,
  nowClockLabel,
  nowLocalLabel,
  partySizeFromMode,
  slotDayOffset,
} from "@/lib/dineTime";
import type { EligibleRestaurant } from "@/domain/types";
import type { DiscoveryInput } from "@/validations/discovery";

export {
  formatSlotLocal,
  formatSlotWhen,
  nowClockLabel,
  nowLocalLabel,
  partySizeFromMode,
};

export const CONCIERGE_PROMPT_VERSION = "dine-concierge.v5";

const conciergeIntentSchema = z.enum([
  "proximity",
  "cuisine",
  "benefit",
  "time",
  "price_high",
  "price_low",
  "general",
]);

const conciergeSchema = z
  .object({
    /** Opcional: se faltar/divergir, usamos o intent determinístico. */
    user_intent: conciergeIntentSchema.optional(),
    intent_label: z.string().min(3).max(160).optional(),
    answer: z.string().min(20).max(1200),
    primary_restaurant_id: z.string().uuid().nullable(),
    alternative_restaurant_ids: z.array(z.string().uuid()).max(2).default([]),
  })
  .passthrough();

export type GroundRestaurant = {
  id: string;
  nome: string;
  culinaria: string;
  bairro: string;
  /** Trecho curto do endereço (só do banco). */
  endereco: string;
  faixaPreco: number;
  promoPct: number;
  /** Rótulos com dia: "hoje às 22h", "amanhã às 19h". */
  slotsLivres: string[];
  slotsIso: string[];
  /** 0=hoje, 1=amanhã… do próximo slot. */
  diaOffsetProximo: number;
  matchCulinaria: boolean;
  vagasProximoSlot: number;
  /** Proxy de “perto”: mesmo bairro da busca + slot mais cedo. */
  proximidadeScore: number;
};

export type ConciergeResult = {
  answer: string;
  isFallback: boolean;
  nowLocal: string;
  orderedIds: string[];
  ground: GroundRestaurant[];
  /** Intenção classificada (determinística + eco do Claude). */
  userIntent: ConciergeIntent;
  /** Rótulo legível do que a pessoa pediu. */
  intentLabel: string;
  /** Motivo quando Claude não fechou (null se sucesso ou nem tentou). */
  aiFailReason?: string;
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

function shortAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 45).trim()}…`;
}

/** Minutos até o próximo slot (proxy de “chegar e sentar”). */
function minutesUntilSlot(iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 9999;
  return Math.max(0, Math.round((t - Date.now()) / 60_000));
}

export function buildGroundRestaurants(
  candidates: EligibleRestaurant[],
  preferredCuisine: string,
  preferredHourSlot: string,
  opts?: {
    intent?: ConciergeIntent;
    searchNeighborhood?: string;
    wantsProximity?: boolean;
    limit?: number;
  },
): GroundRestaurant[] {
  const intent = opts?.intent ?? "general";
  const wantsProximity = opts?.wantsProximity === true;
  const limit = opts?.limit ?? ABUSE_LIMITS.maxRankCandidates;
  const searchNb = (opts?.searchNeighborhood ?? "").toLowerCase();

  const now = new Date();
  const mapped = candidates.map((r) => {
    const culinaria = inferCuisine(r.name, r.description);
    // Só slots futuros (≥ agora); evita sugerir 19h quando já são 21h.
    const slotsIso = r.slots
      .map((s) => s.starts_at)
      .filter((iso) => Date.parse(iso) >= now.getTime() - 60_000)
      .slice(0, 4);
    const match = cuisineMatch(preferredCuisine, culinaria);
    const nearHour = slotsIso.some((s) =>
      slotNearPreferredHour(s, preferredHourSlot),
    );
    const promoPct = Number(r.promo_discount_pct ?? 0);
    const soonest = slotsIso[0] ? minutesUntilSlot(slotsIso[0]) : 9999;
    const diaOffsetProximo = slotsIso[0] ? slotDayOffset(slotsIso[0], now) : 99;
    const sameNb = searchNb
      ? r.neighborhood.toLowerCase() === searchNb
      : true;
    // Sem GPS: “perto” = mesmo bairro da busca + mesa que libera antes.
    // Preferir ainda hoje quando a intenção não pede outro dia.
    const proximidadeScore =
      (sameNb ? 80 : 0) +
      Math.max(0, 60 - Math.min(soonest, 60)) +
      Math.min(r.remaining, 15) -
      Math.min(diaOffsetProximo, 3) * 25;

    let _score = 0;
    if (intent === "proximity") {
      _score =
        proximidadeScore * 2 +
        (nearHour ? 15 : 0) +
        (match ? 10 : 0) +
        (promoPct > 0 ? 5 : 0);
    } else if (intent === "price_high") {
      // Prioriza faixa alta no bairro; culinária do perfil é só desempate.
      _score =
        r.price_range * 50 +
        (sameNb ? 40 : 0) +
        proximidadeScore * 0.25 +
        (nearHour ? 10 : 0) +
        (match ? 5 : 0);
    } else if (intent === "price_low") {
      _score =
        (5 - r.price_range) * 50 +
        (sameNb ? 40 : 0) +
        proximidadeScore * 0.25 +
        (nearHour ? 10 : 0) +
        (match ? 5 : 0);
    } else if (intent === "benefit") {
      _score =
        (promoPct > 0 ? 80 : 0) +
        (match ? 40 : 0) +
        (nearHour ? 25 : 0) +
        proximidadeScore * 0.2;
    } else if (intent === "time") {
      _score =
        (nearHour ? 100 : 0) +
        (match ? 40 : 0) +
        proximidadeScore * 0.3 +
        (promoPct > 0 ? 10 : 0);
    } else if (intent === "cuisine") {
      // “japonesa mais perto”: culinária manda; proximidade só desempatando matches.
      _score =
        (match ? 120 : 0) +
        (match && wantsProximity ? proximidadeScore * 1.5 : proximidadeScore * 0.25) +
        (nearHour ? 30 : 0) +
        (promoPct > 0 ? 10 : 0);
    } else {
      _score =
        (match ? 100 : 0) +
        (nearHour ? 40 : 0) +
        proximidadeScore * 0.35 +
        (promoPct > 0 ? 15 : 0) +
        Math.min(r.remaining, 10);
    }

    return {
      id: r.id,
      nome: r.name,
      culinaria,
      bairro: r.neighborhood,
      endereco: shortAddress(r.address || r.neighborhood),
      faixaPreco: r.price_range,
      promoPct,
      slotsLivres: slotsIso.map((iso) => formatSlotWhen(iso, now)),
      slotsIso,
      diaOffsetProximo,
      matchCulinaria: match,
      vagasProximoSlot: r.remaining,
      proximidadeScore,
      _score,
    };
  });

  return mapped
    .filter((g) => g.slotsIso.length > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...rest }) => {
      void _score;
      return rest;
    });
}

type BenefitPayload = {
  tipo: string;
  valorBrl: number;
  valorBaseBrl: number;
  ticketMinBrl: number;
  pratoGratis: string | null;
  resumo: string;
  resumoBase: string;
  detalhe: string;
};

function benefitPayload(
  input: DiscoveryInput,
  partySize: number,
): BenefitPayload {
  const b = input.benefitContext;
  if (!b || b.benefitType === "nenhum" || !b.benefitType) {
    return {
      tipo: "nenhum",
      valorBrl: 0,
      valorBaseBrl: 0,
      ticketMinBrl: 0,
      pratoGratis: null,
      resumo: "sem benefício ativo",
      resumoBase: "sem benefício ativo",
      detalhe: "",
    };
  }
  const progressive = progressiveBenefitForParty({
    partySize,
    benefitType: b.benefitType,
    benefitValueBrl: b.benefitValueBrl ?? 0,
    minTicketBrl: b.minTicketBrl ?? 0,
    freeDishName: b.freeDishName ?? null,
    avgTicketBrl: b.avgTicketBrl,
  });
  const brl = (n: number) => n.toFixed(2).replace(".", ",");
  const valor = brl(progressive.progressiveValueBrl);
  const base = brl(progressive.baseValueBrl);
  const resumo =
    b.benefitType === "prato_gratis"
      ? `prato grátis${b.freeDishName ? ` de ${b.freeDishName}` : ""}`
      : b.benefitType === "giftback"
        ? `giftback de R$ ${valor}`
        : `cupom de R$ ${valor}`;
  const resumoBase =
    b.benefitType === "prato_gratis"
      ? `prato grátis${b.freeDishName ? ` de ${b.freeDishName}` : ""}`
      : b.benefitType === "giftback"
        ? `giftback de R$ ${base}`
        : `cupom de R$ ${base}`;
  return {
    tipo: b.benefitType,
    valorBrl: progressive.progressiveValueBrl,
    valorBaseBrl: progressive.baseValueBrl,
    ticketMinBrl: progressive.minTicketBrl,
    pratoGratis: b.freeDishName ?? null,
    resumo,
    resumoBase,
    detalhe: progressive.detail,
  };
}

function salonPromoBit(promoPct: number): string {
  const n = Number(promoPct);
  if (!Number.isFinite(n) || n <= 0) return "";
  return ` (${n}% de desconto no salão)`;
}

function benefitAtRestaurant(
  benefit: BenefitPayload,
  restaurantName: string,
  partySize: number,
): string {
  if (benefit.tipo === "nenhum") return "";

  const brl = (n: number) => Number(n).toFixed(2).replace(".", ",");
  const save =
    partySize > 1 && benefit.valorBrl > benefit.valorBaseBrl + 0.01
      ? benefit.valorBrl
      : benefit.valorBaseBrl;

  if (benefit.tipo === "prato_gratis") {
    const dish = benefit.pratoGratis ? ` (${benefit.pratoGratis})` : "";
    return ` No Comer Fora, você leva um prato grátis${dish} em ${restaurantName}.`;
  }

  if (benefit.tipo === "giftback") {
    return ` No Comer Fora, você economiza R$ ${brl(save)} de giftback em ${restaurantName}.`;
  }

  return ` No Comer Fora, você economiza R$ ${brl(save)} em ${restaurantName}.`;
}

function localAnswer(params: {
  ground: GroundRestaurant[];
  preferredCuisine: string;
  nowClock: string;
  displayName?: string;
  benefit: BenefitPayload;
  partySize: number;
  intent: ConciergeIntent;
  neighborhood: string;
  wantsProximity?: boolean;
}): { answer: string; orderedIds: string[] } {
  const nome = firstName(params.displayName ?? "oi");
  const cuisine = cuisineNatural(params.preferredCuisine);
  const cuisineHits = params.ground.filter((g) => g.matchCulinaria);
  const withPromo = params.ground.filter((g) => g.promoPct > 0);
  // Proximidade/preço: ranking já ordenado; culinária/geral: prefere match.
  const primary =
    params.intent === "cuisine" || params.intent === "general"
      ? (cuisineHits[0] ?? params.ground[0])
      : params.ground[0];
  const alts = params.ground
    .filter((g) => g.id !== primary?.id)
    .slice(0, 2);

  if (!primary) {
    return {
      answer: `${nome}, neste horário não encontrei mesas livres em ${params.neighborhood}. Que tal tentar de novo em alguns minutos?`,
      orderedIds: [],
    };
  }

  const placeLine = (
    g: GroundRestaurant,
    opts?: { withAddress?: boolean; cuisine?: boolean },
  ) => {
    const times =
      g.slotsLivres.length > 1
        ? `${g.slotsLivres[0]} ou ${g.slotsLivres[1]}`
        : (g.slotsLivres[0] ?? "em breve");
    const addr = opts?.withAddress ? ` (${g.endereco})` : "";
    const cui = opts?.cuisine ? ` (${g.culinaria})` : "";
    return `${g.nome}${addr}${cui}, ${times}${salonPromoBit(g.promoPct)}`;
  };
  let answer: string;

  if (params.intent === "proximity") {
    answer = `${nome}, agora são ${params.nowClock}. Em ${params.neighborhood} o mais à mão é ${placeLine(primary, { withAddress: true })}.`;
    if (alts.length) {
      answer += ` Em seguida: ${alts.map((a) => placeLine(a, { withAddress: true })).join("; ")}.`;
    }
  } else if (params.intent === "price_high") {
    answer = `${nome}, agora são ${params.nowClock}. O mais caro em ${params.neighborhood} é ${placeLine(primary, { withAddress: true, cuisine: true })}.`;
  } else if (params.intent === "price_low") {
    answer = `${nome}, agora são ${params.nowClock}. O mais em conta em ${params.neighborhood} é ${placeLine(primary, { withAddress: true, cuisine: true })}.`;
  } else if (params.intent === "benefit") {
    const promoHit = withPromo[0] ?? primary;
    answer = `${nome}, agora são ${params.nowClock}. Em ${params.neighborhood}, vale olhar ${placeLine(promoHit)}.`;
    const otherPromos = [primary, ...alts]
      .filter((g) => g.id !== promoHit.id)
      .slice(0, 2);
    if (otherPromos.length) {
      answer += ` Também: ${otherPromos.map((a) => placeLine(a)).join("; ")}.`;
    }
  } else if (params.intent === "time") {
    answer = `${nome}, agora são ${params.nowClock}. A melhor mesa livre é ${placeLine(primary)}.`;
  } else if (cuisineHits.length === 0) {
    answer = `${nome}, agora são ${params.nowClock}. Sem ${cuisine} com vaga em ${params.neighborhood}; a alternativa é ${placeLine(primary, { cuisine: true })}.`;
  } else if (params.wantsProximity) {
    answer = `${nome}, agora são ${params.nowClock}. A ${cuisine} mais à mão em ${params.neighborhood} é ${placeLine(primary, { withAddress: true })}.`;
  } else {
    answer = `${nome}, agora são ${params.nowClock}. Para ${cuisine}, vai de ${placeLine(primary, { withAddress: true })}.`;
  }

  const focus =
    params.intent === "benefit" && withPromo[0] ? withPromo[0] : primary;
  answer += benefitAtRestaurant(params.benefit, focus.nome, params.partySize);

  if (
    params.intent !== "proximity" &&
    params.intent !== "benefit" &&
    alts.length
  ) {
    answer += ` Alternativas: ${alts.map((a) => placeLine(a)).join("; ")}.`;
  }

  return {
    answer,
    orderedIds: [primary.id, ...alts.map((a) => a.id)],
  };
}

function clockTokens(label: string): string[] {
  const tokens: string[] = [];
  // Exige "19h" / "19h30" / "19:30" - evita falso positivo em "grupo de 2".
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

/** Horas (0–23) permitidas: slots do ground + relógio atual (±1h). */
function allowedHours(ground: GroundRestaurant[], nowLocal: string): Set<number> {
  const hours = new Set<number>();
  const add = (token: string) => {
    const h = Number(token.replace(/h\d{0,2}$/i, ""));
    if (Number.isFinite(h) && h >= 0 && h <= 23) hours.add(h);
  };
  for (const g of ground) {
    for (const label of g.slotsLivres) {
      for (const t of clockTokens(label)) add(t);
    }
  }
  for (const t of clockTokens(nowLocal)) add(t);
  for (const t of clockTokens(nowClockLabel())) add(t);
  // Folga no "agora são XXh" (Claude arredonda minuto/hora).
  const nowH = Number(nowClockLabel().replace(/h\d{0,2}$/i, ""));
  if (Number.isFinite(nowH)) {
    hours.add(nowH);
    hours.add((nowH + 23) % 24);
    hours.add((nowH + 1) % 24);
  }
  return hours;
}

/**
 * Guardrail leve: só barra horário inventado (hora fora dos slots/agora).
 * Não exige marcador de dia — falso positivo gerava ground_time_mismatch
 * e jogava prosa boa do Claude no template local.
 */
function validateAnswerAgainstGround(
  answer: string,
  ground: GroundRestaurant[],
  nowLocal: string,
): boolean {
  const hours = allowedHours(ground, nowLocal);
  if (hours.size === 0) return true;

  for (const token of clockTokens(answer)) {
    const h = Number(token.replace(/h\d{0,2}$/i, ""));
    if (!Number.isFinite(h)) continue;
    if (!hours.has(h)) return false;
  }
  return true;
}

export async function generateDineConciergeAnswer(params: {
  candidates: EligibleRestaurant[];
  input: DiscoveryInput;
  forceFallback?: boolean;
}): Promise<ConciergeResult> {
  // 1) Pipeline hardcoded - nunca envia bruto ao Claude (AGENTS §7.2).
  const pre = runConciergePreLlm(params.input.queryText);
  const nowLocal = nowLocalLabel();
  const nowClock = nowClockLabel();
  const intent = pre.entities.intent;
  const defaultIntentLabel = pre.safeQuery.trim()
    ? pre.safeQuery.trim().slice(0, 120)
    : CONCIERGE_INTENT_LABELS[intent];

  const withIntent = (
    base: Omit<ConciergeResult, "userIntent" | "intentLabel"> &
      Partial<Pick<ConciergeResult, "userIntent" | "intentLabel">>,
  ): ConciergeResult => ({
    ...base,
    userIntent: base.userIntent ?? intent,
    intentLabel: base.intentLabel ?? defaultIntentLabel,
  });

  if (!pre.allowLlm) {
    return withIntent({
      answer: pre.safeRedirectAnswer,
      isFallback: true,
      nowLocal,
      orderedIds: [],
      ground: [],
      blockedByGuard: true,
      guardRuleIds: pre.ruleIds,
    });
  }

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
  const ground = buildGroundRestaurants(
    params.candidates,
    preferredCuisine,
    preferredHourSlot,
    {
      intent,
      searchNeighborhood: params.input.neighborhood,
      wantsProximity: pre.entities.wantsProximity,
    },
  );
  const benefit = benefitPayload(params.input, params.input.partySize);
  const local = localAnswer({
    ground,
    preferredCuisine,
    nowClock,
    displayName: profile?.displayName,
    benefit,
    partySize: params.input.partySize,
    intent,
    neighborhood: params.input.neighborhood,
    wantsProximity: pre.entities.wantsProximity,
  });

  const env = getServerEnv();
  /** Local só depois de falha real do Claude (ou AI indisponível). */
  const localFallback = (reason: string) =>
    withIntent({
      answer: local.answer,
      isFallback: true,
      nowLocal,
      orderedIds: local.orderedIds,
      ground,
      aiFailReason: reason,
    });

  // skipAi explícito: não chama Claude.
  if (params.forceFallback || params.input.skipAi === true) {
    return localFallback("skip_ai");
  }
  if (!params.input.conversational) {
    return localFallback("not_conversational");
  }
  if (!env.AI_ENABLED || !env.API_KEY_CLAUDE) {
    return localFallback("ai_disabled");
  }
  if (ground.length === 0) {
    return localFallback("no_eligible_slots");
  }

  const allowedIds = new Set(ground.map((g) => g.id));
  const safeUserQuery = escapeUserDelimiters(pre.safeQuery);
  // 2) Ground truth + pergunta do user (AGENTS §7.3).
  const payload = {
    agora: nowClock,
    bairroBusca: params.input.neighborhood,
    intent,
    intent_label_sugerido: defaultIntentLabel,
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
    agoraCompleto: nowLocal,
    restaurantes: ground.map((g) => ({
      id: g.id,
      nome: g.nome,
      culinaria: g.culinaria,
      bairro: g.bairro,
      endereco: g.endereco,
      faixaPreco: g.faixaPreco,
      promoPct: g.promoPct,
      slotsLivres: g.slotsLivres,
      diaOffsetProximo: g.diaOffsetProximo,
      matchCulinariaFavorita: g.matchCulinaria,
      proximidadeScore: g.proximidadeScore,
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
      intent,
      benefit.tipo,
      ground.map((g) => [g.id, g.slotsLivres[0], g.promoPct]),
      pre.safeQuery.slice(0, 80),
    ],
    temperature: 0.35,
    maxTokens: ABUSE_LIMITS.maxOutputTokensConcierge,
    // Mesmo Haiku das métricas — Sonnet estourava timeout/throttle na demo.
    model: CLAUDE_MODEL_FAST,
  });

  if (!text) {
    return localFallback(consumeClaudeFailReason() ?? "claude_empty");
  }

  try {
    const parsed = conciergeSchema.safeParse(JSON.parse(unwrapJsonText(text)));
    if (!parsed.success) {
      return localFallback("schema_invalid");
    }

    const primary = parsed.data.primary_restaurant_id;
    const alts = (parsed.data.alternative_restaurant_ids ?? []).filter(
      (id) => allowedIds.has(id) && id !== primary,
    );
    if (primary && !allowedIds.has(primary)) {
      return localFallback("primary_id_invalid");
    }

    const safety = rawModelTextSafe({
      rawText: text,
      canary: process.env.LLM_CANARY ?? "",
      systemPrompt: system,
    });
    if (!safety.ok) {
      return localFallback(`output_guard:${safety.reason ?? "fail"}`);
    }

    // Horário: só alerta interno. IDs já validados — não descarta o Claude.
    const timeOk = validateAnswerAgainstGround(
      parsed.data.answer,
      ground,
      nowLocal,
    );

    const orderedIds = [
      ...(primary ? [primary] : local.orderedIds.slice(0, 1)),
      ...alts,
      ...local.orderedIds.filter(
        (id) => id !== primary && !alts.includes(id),
      ),
    ].slice(0, 3);

    // Intenção: preferimos a determinística se o eco do Claude divergir.
    const echoed = parsed.data.user_intent;
    const finalIntent = echoed && echoed === intent ? echoed : intent;
    const finalLabel =
      parsed.data.intent_label?.trim().slice(0, 160) || defaultIntentLabel;

    return withIntent({
      answer: parsed.data.answer.trim(),
      isFallback: false,
      nowLocal,
      orderedIds,
      ground,
      userIntent: finalIntent,
      intentLabel: finalLabel,
      ...(timeOk ? {} : { aiFailReason: "time_soft_warn" }),
    });
  } catch {
    return localFallback("parse_error");
  }
}
