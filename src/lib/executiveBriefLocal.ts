import type { DashboardPayload } from "@/services/analyticsEngine";

/** Briefing executivo sem chamar LLM (zero RPM). */
export function executiveBriefLocal(
  dash: DashboardPayload,
  reason?: string,
) {
  const mix = dash.strategyMix;
  const top = dash.regression.featureNames
    .map((n, i) => ({ n, b: dash.regression.betas[i] }))
    .sort((a, b) => Math.abs(b.b) - Math.abs(a.b))[0];

  return {
    headline:
      "A verba rende melhor quando cupom, giftback e prato grátis entram só onde o retorno se paga.",
    lucroReal: `Retorno ${dash.kpis.roi}x · faturamento ${dash.kpis.gmvDeltaPct > 0 ? "+" : ""}${dash.kpis.gmvDeltaPct}% · mix ${mix.cupom} cupom / ${mix.giftback} giftback / ${mix.prato_gratis} prato / ${mix.nenhum} sem benefício.`,
    canibalizacao:
      "Risco maior em VIP Orgânicos se o cupom for agressivo demais — aí o desconto come margem de quem já pagaria cheio.",
    proximoPasso: top
      ? `Priorize ações ligadas a “${top.n}” e escale só estratégias com retorno positivo por pessoa e por restaurante.`
      : "Escale só estratégias com retorno positivo por pessoa e por restaurante.",
    isFallback: true as const,
    ...(reason ? { fallbackReason: reason } : {}),
  };
}
