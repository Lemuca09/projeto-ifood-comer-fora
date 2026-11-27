import { inputGuard, type GuardResult } from "@/guardrails/inputGuard";
import { NEIGHBORHOODS } from "@/lib/constants";

/**
 * Pipeline hardcoded pré-LLM (AGENTS.md §7.1–7.2 + spec Concierge).
 * NUNCA envia input bruto ao Claude - short-circuit em ataque/fora de escopo.
 */

const CUISINES = [
  "japonesa",
  "japones",
  "sushi",
  "italiana",
  "pizza",
  "brasileira",
  "brasileiro",
  "árabe",
  "arabe",
  "hambúrguer",
  "hamburguer",
  "burger",
  "vegetariana",
  "vegana",
  "mexicana",
  "chinesa",
  "thai",
  "frutos do mar",
  "peixe",
  "carne",
  "churrasco",
] as const;

const IN_SCOPE =
  /\b(jantar|almo[cç]ar|comer|restaurante|mesa|reserva|sal[aã]o|comer\s+fora|onde\s+(jantar|comer)|culin[aá]ria|comida|bairro|grupo|pessoas|barato|caro|promo|cupom|giftback|prato)\b/i;

const OUT_OF_SCOPE =
  /\b(bitcoin|crypto|elei[cç][aã]o|pol[ií]tica|escreva\s+c[oó]digo|python|javascript|hacke|senha|password|api\s+key|weapon|bomba)\b/i;

export type ConciergeEntities = {
  cuisine?: string;
  hourHint?: string;
  neighborhood?: (typeof NEIGHBORHOODS)[number];
  partySize?: number;
  priceHint?: "baixo" | "medio" | "alto";
  intentInScope: boolean;
};

export type PreLlmResult = {
  allowLlm: boolean;
  guard: GuardResult;
  entities: ConciergeEntities;
  /** Texto limpo e truncado - único permitido no payload do modelo. */
  safeQuery: string;
  /** Resposta padrão se bloquear (sem revelar regra/score). */
  safeRedirectAnswer: string;
  ruleIds: string[];
};

export const SAFE_REDIRECT_ANSWER =
  "Posso te ajudar a escolher onde jantar agora. Me diga o tipo de comida, o horário ou o bairro - mostro opções com mesa disponível e benefícios reais da sua conta.";

function extractEntities(text: string): ConciergeEntities {
  const lower = text.toLowerCase();
  const cuisine = CUISINES.find((c) => lower.includes(c));
  const hour =
    text.match(/\b([01]?\d|2[0-3])h([0-5]\d)?\b/i)?.[0] ??
    text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0] ??
    undefined;
  const neighborhood = NEIGHBORHOODS.find((n) =>
    lower.includes(n.toLowerCase()),
  );
  // Exige contexto de grupo - evita capturar "às 20", "em 15 minutos", etc.
  const partyMatch =
    text.match(
      /\b(?:grupo\s+de|mesa\s+para|para)\s+(\d{1,2})\b/i,
    ) ??
    text.match(/\b(\d{1,2})\s*(pessoas?|amigos?|pessoal)\b/i);
  let partySize: number | undefined;
  if (partyMatch) {
    const n = Number(partyMatch[1]);
    if (n >= 1 && n <= 20) partySize = n;
  }
  let priceHint: ConciergeEntities["priceHint"];
  if (/barat|econ[oô]mic|custo.?benef/i.test(text)) priceHint = "baixo";
  else if (/caro|premium|sofistic/i.test(text)) priceHint = "alto";
  else if (/m[eé]dio|razo[aá]vel/i.test(text)) priceHint = "medio";

  const intentInScope =
    !OUT_OF_SCOPE.test(text) &&
    (IN_SCOPE.test(text) ||
      !!cuisine ||
      !!hour ||
      !!neighborhood ||
      !!partySize ||
      text.trim().length < 12);

  return {
    cuisine,
    hourHint: hour,
    neighborhood,
    partySize,
    priceHint,
    intentInScope,
  };
}

/**
 * Middleware determinístico antes de qualquer chamada Claude do concierge.
 */
export function runConciergePreLlm(rawQuery: string | undefined | null): PreLlmResult {
  const raw = (rawQuery ?? "").slice(0, 500);
  const guard = inputGuard(raw);
  const entities = extractEntities(guard.textoSeguro);
  const ruleIds = [...guard.ruleIds];

  if (!entities.intentInScope && guard.textoSeguro.length >= 12) {
    ruleIds.push("out_of_scope");
  }

  const blocked =
    guard.decisao === "bloquear" ||
    ruleIds.includes("out_of_scope") ||
    ruleIds.includes("force_discount") ||
    ruleIds.includes("override_business") ||
    ruleIds.includes("sqli") ||
    ruleIds.includes("code_injection") ||
    ruleIds.includes("toxicity");

  const degraded = guard.decisao === "degradar";

  return {
    allowLlm: !blocked && !degraded,
    guard,
    entities,
    safeQuery: guard.textoSeguro,
    safeRedirectAnswer: SAFE_REDIRECT_ANSWER,
    ruleIds,
  };
}
