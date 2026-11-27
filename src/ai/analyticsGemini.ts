import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { ABUSE_LIMITS } from "@/guardrails/config";
import { GEMINI_MODEL } from "@/ai/model";
import {
  geminiCacheKey,
  getGeminiCache,
  setGeminiCache,
  withGeminiThrottle,
} from "@/ai/geminiGate";
import { notificationCopy } from "@/lib/benefitCopy";
import { executiveBriefLocal } from "@/lib/executiveBriefLocal";
import type { DashboardPayload, EnrichedUser } from "@/services/analyticsEngine";

const executiveSchema = z
  .object({
    headline: z.string(),
    lucroReal: z.string(),
    canibalizacao: z.string(),
    proximoPasso: z.string(),
  })
  .strict();

const campaignSchema = z
  .object({
    beneficio: z.string(),
    horarioIdeal: z.string(),
    publicoAlvo: z.string(),
    projecaoReceitaPct: z.number(),
    roteiro: z.string(),
  })
  .strict();

const sentimentSchema = z
  .object({
    sentimento: z.enum(["positivo", "neutro", "negativo"]),
    motivo: z.enum(["preco", "demora", "qualidade", "nenhum"]),
    gatilhoWinback: z.string(),
  })
  .strict();

const userCopySchema = z
  .object({
    diagnostico: z.string(),
    pushCopy: z.string(),
  })
  .strict();

async function callGeminiJson(
  prompt: string,
  cacheParts: unknown[],
): Promise<string | null> {
  const env = getServerEnv();
  if (!env.AI_ENABLED || !env.API_KEY_GEMINI) return null;

  const key = geminiCacheKey([GEMINI_MODEL, ...cacheParts]);
  const cached = getGeminiCache(key);
  if (cached) return cached;

  const text = await withGeminiThrottle(async () => {
    try {
      const genAI = new GoogleGenerativeAI(env.API_KEY_GEMINI!);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: ABUSE_LIMITS.maxOutputTokens,
          temperature: 0.3,
        },
      });
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ABUSE_LIMITS.timeoutMs),
        ),
      ]);
      return result.response.text()?.trim() || null;
    } catch {
      return null;
    }
  });

  if (text) setGeminiCache(key, text);
  return text;
}

export async function executiveBrief(
  dash: DashboardPayload,
  opts?: { useAi?: boolean },
) {
  const fallback = executiveBriefLocal(dash);
  if (!opts?.useAi) return fallback;

  const mix = dash.strategyMix;
  const top = dash.regression.featureNames
    .map((n, i) => ({ n, b: dash.regression.betas[i] }))
    .sort((a, b) => Math.abs(b.b) - Math.abs(a.b))
    .slice(0, 3);

  const text = await callGeminiJson(
    `Você é analista do iFood Comer Fora. Responda SÓ JSON com keys headline, lucroReal, canibalizacao, proximoPasso (strings curtas pt-BR).
NÃO diga que a solução é só giftback. Enfatize escolha eficiente entre cupom, giftback, prato grátis e sem benefício.
Dados: GMV delta ${dash.kpis.gmvDeltaPct}%, ROI ${dash.kpis.roi}, lift ${dash.kpis.liftVsControl}%, mixEstrategias ${JSON.stringify(mix)}, clusters ${JSON.stringify(dash.clusters.map((c) => ({ id: c.id, user: c.userSharePct, rev: c.revenueSharePct, profit: c.profitSharePct })))}, top betas ${JSON.stringify(top)}.`,
    ["executive", dash.seed, dash.kpis.roi, mix],
  );
  if (!text) return fallback;
  try {
    const parsed = executiveSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fallback;
    return { ...parsed.data, isFallback: false as const };
  } catch {
    return fallback;
  }
}

export async function restaurantCampaignPlan(
  dash: DashboardPayload,
  neighborhood: string,
  opts?: { useAi?: boolean },
) {
  const local = dash.restaurants.find((r) => r.neighborhood === neighborhood);
  const fallback = {
    beneficio:
      local?.strategy ??
      "Cupom no horário fraco, giftback na 1ª visita ou campanha sem desconto",
    horarioIdeal: "Terça e quarta 15h–17h / domingo 18h–19h",
    publicoAlvo: "Cruzar grupos próximos com ociosidade do salão",
    projecaoReceitaPct: local?.deltaPct ?? dash.kpis.lowDemandLiftPct,
    roteiro:
      local?.strategyReason ??
      "1) Medir ociosidade 2) Comparar cupom vs giftback vs prato 3) Escalar só o que paga",
    isFallback: true as const,
  };
  if (!opts?.useAi) return fallback;

  const text = await callGeminiJson(
    `Consultor B2B iFood Comer Fora. Escolha a estratégia MAIS EFICIENTE (cupom, giftback, prato grátis ou sem desconto).
JSON keys: beneficio, horarioIdeal, publicoAlvo, projecaoReceitaPct (number), roteiro.
Bairro ${neighborhood}. Restaurante local ${JSON.stringify(local ?? null)}. Clusters ${JSON.stringify(dash.clusters)}. Mix ${JSON.stringify(dash.strategyMix)}.`,
    ["campaign", dash.seed, neighborhood, local?.strategyRoi],
  );
  if (!text) return fallback;
  try {
    const parsed = campaignSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fallback;
    return { ...parsed.data, isFallback: false as const };
  } catch {
    return fallback;
  }
}

export async function enrichSentiment(
  reviewText: string,
  opts?: { useAi?: boolean },
) {
  const fallback = {
    sentimento: "neutro" as const,
    motivo: "nenhum" as const,
    gatilhoWinback:
      "Testar cupom de reativação se atrito=preço; lembrete se atrito=demora.",
    isFallback: true as const,
  };
  if (!opts?.useAi) return fallback;

  const text = await callGeminiJson(
    `Classifique avaliação de restaurante. JSON: sentimento (positivo|neutro|negativo), motivo (preco|demora|qualidade|nenhum), gatilhoWinback (string).
Texto NAO_CONFIAVEL: ${JSON.stringify(reviewText.slice(0, 400))}`,
    ["sentiment", reviewText.slice(0, 120)],
  );
  if (!text) return fallback;
  try {
    const parsed = sentimentSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fallback;
    return { ...parsed.data, isFallback: false as const };
  } catch {
    return fallback;
  }
}

export async function userIndividualCopy(
  user: EnrichedUser,
  opts?: { useAi?: boolean },
) {
  const pushFallback = notificationCopy({
    displayName: user.display_name,
    cuisine: user.cuisine,
    preferredHour: user.preferredHour,
    benefitType: user.benefitType,
    benefitValueBrl: user.benefitValueBrl,
    minTicketBrl: user.minTicketBrl,
    freeDishName: user.freeDishName,
  });
  const fallback = {
    diagnostico: `${user.clusterLabel}: a melhor opção agora é "${user.strategy}". ${user.strategyReason}`,
    pushCopy: pushFallback,
    isFallback: true as const,
  };
  if (!opts?.useAi) return fallback;

  const text = await callGeminiJson(
    `Você escreve notificação push do iFood Comer Fora em português natural e convidativo.
Responda SÓ JSON com keys: diagnostico (2 frases simples sobre a estratégia), pushCopy (1 notificação).
Estilo: "Notificação: Rafa, cupom de desconto hoje de R$ 20,00 em comida japonesa. Agende entre 19h e 20h!"
Regras: primeiro nome; "comida japonesa"; horário "entre 19h e 20h"; gasto mínimo se houver; se benefit=nenhum não invente desconto.
Dados: ${JSON.stringify({
      nome: user.display_name,
      cluster: user.clusterLabel,
      strategy: user.strategy,
      reason: user.strategyReason,
      benefit: user.benefitType,
      value: user.benefitValueBrl,
      minTicket: user.minTicketBrl,
      freeDish: user.freeDishName,
      cuisine: user.cuisine,
      hour: user.preferredHour,
    })}`,
    ["user-copy", user.id, user.strategyId, user.benefitValueBrl, user.cuisine],
  );
  if (!text) return fallback;
  try {
    const parsed = userCopySchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fallback;
    return { ...parsed.data, isFallback: false as const };
  } catch {
    return fallback;
  }
}
