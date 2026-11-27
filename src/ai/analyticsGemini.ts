import { z } from "zod";
import { callClaudeText, consumeClaudeFailReason } from "@/ai/claudeClient";
import { CLAUDE_MODEL_FAST } from "@/ai/model";
import { ABUSE_LIMITS } from "@/guardrails/config";
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

async function callClaudeJson(
  prompt: string,
  cacheParts: unknown[],
  maxTokens: number,
): Promise<string | null> {
  return callClaudeText({
    user: prompt,
    cacheParts,
    temperature: 0.2,
    maxTokens,
    model: CLAUDE_MODEL_FAST,
  });
}

export async function executiveBrief(
  dash: DashboardPayload,
  opts?: { useAi?: boolean; fallbackReason?: string },
) {
  const fallback = () =>
    executiveBriefLocal(dash, opts?.fallbackReason ?? "ai_disabled");
  if (!opts?.useAi) return fallback();

  const mix = dash.strategyMix;
  const top = dash.regression.featureNames
    .map((n, i) => ({ n, b: Number(dash.regression.betas[i].toFixed(2)) }))
    .sort((a, b) => Math.abs(b.b) - Math.abs(a.b))
    .slice(0, 2);
  const clusters = dash.clusters.map((c) => ({
    id: c.id,
    u: Math.round(c.userSharePct),
    p: Math.round(c.profitSharePct),
  }));

  const text = await callClaudeJson(
    `Analista Comer Fora. JSON keys: headline,lucroReal,canibalizacao,proximoPasso (pt-BR, ≤18 palavras cada). Escolha eficiente cupom|giftback|prato|nenhum — não diga "só giftback".
d:{gmvΔ:${dash.kpis.gmvDeltaPct},roi:${dash.kpis.roi},lift:${dash.kpis.liftVsControl},mix:${JSON.stringify(mix)},cl:${JSON.stringify(clusters)},β:${JSON.stringify(top)}}`,
    ["executive", dash.seed, dash.kpis.roi, mix.cupom, mix.giftback],
    ABUSE_LIMITS.maxOutputTokensAnalytics,
  );
  if (!text) {
    return executiveBriefLocal(
      dash,
      consumeClaudeFailReason() ?? "claude_empty_or_auth",
    );
  }
  try {
    const parsed = executiveSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return executiveBriefLocal(dash, "claude_parse");
    return { ...parsed.data, isFallback: false as const };
  } catch {
    return executiveBriefLocal(dash, "claude_parse");
  }
}

export async function restaurantCampaignPlan(
  dash: DashboardPayload,
  neighborhood: string,
  opts?: { useAi?: boolean },
) {
  const locals = dash.restaurants.filter(
    (r) => r.neighborhood === neighborhood,
  );
  const local =
    locals.sort((a, b) => b.strategyRoi - a.strategyRoi)[0] ??
    dash.restaurants[0];
  const restaurantNames = locals.map((r) => r.name).join(", ") || neighborhood;
  const season = dash.seasonalityContext;
  const fallback = {
    beneficio:
      local?.strategy ??
      "Cupom no horário fraco, giftback na 1ª visita ou campanha sem desconto",
    horarioIdeal: season.isPaydayWindow
      ? "Dias 5–15: empurrar Comer Fora com cupom/giftback/prato — usuário com poder de compra"
      : season.preferLowDiscount
        ? "Feriado/véspera lotada: notificação orgânica; cupom só em horário morto"
        : "Terça e quarta 15h–17h / domingo 18h–19h — estimular fora da janela de salário com trava",
    publicoAlvo: `Parceiros em ${neighborhood}${
      locals.length ? ` (${restaurantNames})` : ""
    } · clusters × ociosidade × sazonalidade (${season.summary})`,
    projecaoReceitaPct: local?.deltaPct ?? dash.kpis.lowDemandLiftPct,
    roteiro:
      local?.strategyReason ??
      `1) Calendário 2) Intensidade ×${season.benefitIntensityMult} 3) Comparar estratégias 4) Escalar o que paga`,
    isFallback: true as const,
  };
  if (!opts?.useAi) return fallback;

  const compactLocal = local
    ? {
        name: local.name,
        strat: local.strategy,
        roi: local.strategyRoi,
        idle: local.idlePct,
        ben: local.benefitType,
      }
    : null;
  const seasonMini = {
    pay: season.isPaydayWindow,
    hol: season.holidayName,
    inten: season.benefitIntensityMult,
    lowDisc: season.preferLowDiscount,
  };

  const text = await callClaudeJson(
    `B2B Comer Fora. JSON: beneficio,horarioIdeal,publicoAlvo,projecaoReceitaPct(number),roteiro (curto).
Escolha cupom|giftback|prato|nenhum. Salário 5–15=mais incentivo; feriado lotado=leve.
hood:${neighborhood} rests:${restaurantNames.slice(0, 80)}
season:${JSON.stringify(seasonMini)} ref:${JSON.stringify(compactLocal)} mix:${JSON.stringify(dash.strategyMix)}`,
    [
      "campaign",
      dash.seed,
      neighborhood,
      local?.strategyRoi,
      local?.name,
      season.benefitIntensityMult,
    ],
    ABUSE_LIMITS.maxOutputTokensAnalytics,
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

  const snippet = reviewText.slice(0, 160);
  const text = await callClaudeJson(
    `JSON: sentimento(positivo|neutro|negativo),motivo(preco|demora|qualidade|nenhum),gatilhoWinback(≤12 palavras).
txt:${JSON.stringify(snippet)}`,
    ["sentiment", snippet.slice(0, 80)],
    ABUSE_LIMITS.maxOutputTokensTiny,
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

  const first =
    user.display_name.replace(/^Persona\s+/i, "").trim().split(/\s+/)[0] ||
    "oi";
  const text = await callClaudeJson(
    `Notificação iFood Comer Fora. JSON: diagnostico(≤2 frases),pushCopy(1 notificação curta).
Ex: "Notificação: Rafa, cupom de R$ 20 em comida japonesa. Agende entre 19h e 20h!"
Se benefit=nenhum não invente desconto. Nome:${first}
d:${JSON.stringify({
      cl: user.clusterLabel,
      st: user.strategy,
      ben: user.benefitType,
      v: user.benefitValueBrl,
      min: user.minTicketBrl,
      dish: user.freeDishName,
      cui: user.cuisine,
      h: user.preferredHour,
    })}`,
    ["user-copy", user.id, user.strategyId, user.benefitValueBrl, user.cuisine],
    ABUSE_LIMITS.maxOutputTokensAnalytics,
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
