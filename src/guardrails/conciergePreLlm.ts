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
  /\b(jantar|almo[cç]ar|comer|restaurantes?|mesa|reserva|sal[aã]o|comer\s+fora|onde\s+(jantar|comer|acho|fica|encontrar)|culin[aá]ria|comida|bairro|grupo|pessoas|barato|caro|premium|promo|cupom|giftback|prato|pert[oa]|pr[oó]xim|dist[aâ]ncia|faixa\s+de\s+pre[cç]o|fila|espera|r[aá]pido|ocios|indique|recomende)\b/i;

export type ConciergeIntent =
  | "proximity"
  | "cuisine"
  | "benefit"
  | "time"
  | "price_high"
  | "price_low"
  | "wait_low"
  | "general";

export const CONCIERGE_INTENT_LABELS: Record<ConciergeIntent, string> = {
  proximity: "lugar mais perto / à mão",
  cuisine: "culinária pedida",
  benefit: "benefício / promo",
  time: "horário",
  price_high: "restaurante mais caro / premium",
  price_low: "restaurante mais barato / econômico",
  wait_low: "pouca fila / espera curta",
  general: "sugestão geral para jantar",
};

const OUT_OF_SCOPE =
  /\b(bitcoin|crypto|elei[cç][aã]o|pol[ií]tica|escreva\s+c[oó]digo|python|javascript|hacke|senha|password|api\s+key|weapon|bomba|matar|te\s+mato|assassina|kill\s+you)\b/i;

export type ConciergeEntities = {
  cuisine?: string;
  hourHint?: string;
  neighborhood?: (typeof NEIGHBORHOODS)[number];
  partySize?: number;
  priceHint?: "baixo" | "medio" | "alto";
  /** Pediu proximidade (“perto de mim”) — pode coexistir com culinária. */
  wantsProximity: boolean;
  /** Intenção dominante da pergunta (ranking + texto natural). */
  intent: ConciergeIntent;
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
  "Não posso te ajudar com esse pedido. Para eu indicar um lugar no Comer Fora, escreva sobre comida, bairro, horário, fila ou proximidade - por exemplo: “italiana no Gonzaga às 20h”, “pouca fila de espera” ou “onde jantar com cupom”.";

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
  if (/mais\s+barat|baratinho|econ[oô]mic|custo.?benef|mais\s+em\s+conta/i.test(text)) {
    priceHint = "baixo";
  } else if (
    /mais\s+caro|car[ií]ssimo|premium|sofistic|alto\s+padr[aã]o|faixa\s+alta/i.test(
      text,
    )
  ) {
    priceHint = "alto";
  } else if (/m[eé]dio|razo[aá]vel/i.test(text)) {
    priceHint = "medio";
  }

  const wantsProximity =
    /\b(mais\s+pert[oa]|mais\s+pr[oó]xim[oa]|pert[oa]\s+de\s+mim|pertinho|pr[oó]xim[oa]s?|dist[aâ]ncia|onde\s+(acho|fica|encontrar)|agora)\b/i.test(
      text,
    );

  const wantsLowWait =
    /\b(pouca\s+fila|sem\s+fila|fila\s+(curta|baixa|pequena)|espera\s+(curta|baixa|r[aá]pida)|pouca\s+espera|r[aá]pido\s+(pra\s+)?entrar|menos\s+espera|sem\s+esperar)\b/i.test(
      text,
    );

  // Prioridade: preço > fila/espera > culinária > proximidade > benefício > horário.
  let intent: ConciergeIntent = "general";
  if (priceHint === "alto") {
    intent = "price_high";
  } else if (priceHint === "baixo") {
    intent = "price_low";
  } else if (wantsLowWait) {
    intent = "wait_low";
  } else if (cuisine) {
    intent = "cuisine";
  } else if (wantsProximity) {
    intent = "proximity";
  } else if (
    /\b(cupom|giftback|desconto|promo(c|ç)[aã]o|prato\s+gr[aá]tis|benef[ií]cio)\b/i.test(
      text,
    )
  ) {
    intent = "benefit";
  } else if (hour) {
    intent = "time";
  }

  // Frases curtas sem sinal de jantar NÃO entram no escopo (evita “ok”, ameaças curtas, etc.).
  const diningSignal =
    IN_SCOPE.test(text) ||
    !!cuisine ||
    !!hour ||
    !!neighborhood ||
    !!partySize ||
    wantsProximity ||
    wantsLowWait ||
    intent === "price_high" ||
    intent === "price_low" ||
    intent === "wait_low";
  const intentInScope = !OUT_OF_SCOPE.test(text) && diningSignal;

  return {
    cuisine,
    hourHint: hour,
    neighborhood,
    partySize,
    priceHint,
    wantsProximity,
    intent,
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

  if (!entities.intentInScope && guard.textoSeguro.trim().length > 0) {
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
