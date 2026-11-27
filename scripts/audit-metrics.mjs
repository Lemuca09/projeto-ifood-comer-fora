/**
 * Métricas palpáveis do motor analítico + painel parceiro (sintético).
 * node --env-file=.env --experimental-strip-types scripts/audit-metrics.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { buildAnalyticsDashboard } from "../src/services/analyticsEngine.ts";
import { buildPartnerDashboard } from "../src/domain/dineOut/partnerMetrics.ts";
import { buildRetentionCurves } from "../src/domain/analytics/seasonality.ts";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await s.from("synthetic_users").select("*");
if (error) {
  console.error(error);
  process.exit(1);
}
const users = data ?? [];
console.log(`BASE: ${users.length} personas sintéticas no Supabase\n`);

const seeds = [42, 100, 777];
const rows = [];

for (const seed of seeds) {
  const d = buildAnalyticsDashboard(users, seed);
  const marginBefore = d.users.reduce((a, u) => a + u.marginBefore, 0);
  const marginAfter = d.users.reduce((a, u) => a + u.marginAfter, 0);
  const lucroLiquidoDelta = marginAfter - marginBefore;
  const ret = buildRetentionCurves(seed);
  const d30 = ret.find((r) => r.day === 30);
  const partner = buildPartnerDashboard(seed, "Casa Demo", "Gonzaga");
  const trad = partner.scenarios[0];
  const cf = partner.scenarios[1];
  const ben = partner.scenarios[2];

  const row = {
    seed,
    nUsers: d.users.length,
    gmvBefore: d.kpis.gmvBefore,
    gmvAfter: d.kpis.gmvAfter,
    gmvDeltaAbs: d.kpis.gmvDeltaAbs,
    gmvDeltaPct: d.kpis.gmvDeltaPct,
    marginBefore: Number(marginBefore.toFixed(2)),
    marginAfter: Number(marginAfter.toFixed(2)),
    lucroLiquidoDelta: Number(lucroLiquidoDelta.toFixed(2)),
    lucroLiquidoPct: Number(((lucroLiquidoDelta / Math.max(marginBefore, 1)) * 100).toFixed(1)),
    campaignCost: d.kpis.campaignCost,
    incrementalNetRevenue: d.kpis.incrementalNetRevenue,
    roi: d.kpis.roi,
    liftVsControlPct: d.kpis.liftVsControl,
    novosComerFora: d.kpis.newComerForaUsers,
    novosComerForaPct: d.kpis.newComerForaPct,
    mix: d.strategyMix,
    ret30: {
      giftback: d30.giftback,
      cupom: d30.cupom,
      controle: d30.controle,
      giftVsCtrlPp: Number(((d30.giftback - d30.controle) * 100).toFixed(1)),
    },
    partner: {
      tradMargin: trad.netMarginBrl,
      cfMargin: cf.netMarginBrl,
      benMargin: ben.netMarginBrl,
      lucroCfVsTrad: cf.netMarginBrl - trad.netMarginBrl,
      lucroBenVsTrad: ben.netMarginBrl - trad.netMarginBrl,
      recTrad: trad.recurrencePct,
      recBen: ben.recurrencePct,
      recDeltaPp: Number((ben.recurrencePct - trad.recurrencePct).toFixed(1)),
      occTrad: trad.occupancyPct,
      occBen: ben.occupancyPct,
    },
  };
  rows.push(row);

  console.log(`======== SEED ${seed} ========`);
  console.log(
    `Usuários na base: ${row.nUsers} | Novos no Comer Fora: ${row.novosComerFora} (${row.novosComerForaPct}%)`,
  );
  console.log(
    `GMV: R$ ${row.gmvBefore.toFixed(0)} → R$ ${row.gmvAfter.toFixed(0)}  (Δ R$ ${row.gmvDeltaAbs.toFixed(0)} / ${row.gmvDeltaPct}%)`,
  );
  console.log(
    `Lucro líquido (margem): R$ ${row.marginBefore.toFixed(0)} → R$ ${row.marginAfter.toFixed(0)}  (Δ R$ ${row.lucroLiquidoDelta.toFixed(0)} / ${row.lucroLiquidoPct}%)`,
  );
  console.log(
    `Custo campanha: R$ ${row.campaignCost.toFixed(0)} | Receita incremental líquida: R$ ${row.incrementalNetRevenue.toFixed(0)} | ROI: ${row.roi}x | Lift vs controle: ${row.liftVsControlPct} pp`,
  );
  console.log(
    `Mix: cupom ${row.mix.cupom} | giftback ${row.mix.giftback} | prato ${row.mix.prato_gratis} | nenhum ${row.mix.nenhum}`,
  );
  console.log(
    `Retenção D30: giftback ${(row.ret30.giftback * 100).toFixed(1)}% | cupom ${(row.ret30.cupom * 100).toFixed(1)}% | controle ${(row.ret30.controle * 100).toFixed(1)}% | gift−ctrl +${row.ret30.giftVsCtrlPp} pp`,
  );
  console.log(
    `Parceiro/mês: margem trad R$ ${row.partner.tradMargin} → CF R$ ${row.partner.cfMargin} (Δ R$ ${row.partner.lucroCfVsTrad}) → CF+benef R$ ${row.partner.benMargin} (Δ R$ ${row.partner.lucroBenVsTrad})`,
  );
  console.log(
    `Parceiro recorrência: ${row.partner.recTrad}% → ${row.partner.recBen}% (+${row.partner.recDeltaPp} pp) | ocupação ${row.partner.occTrad}% → ${row.partner.occBen}%\n`,
  );
}

const avg = (fn) => rows.reduce((a, r) => a + fn(r), 0) / rows.length;
console.log("======== MÉDIA DOS SEEDS ========");
console.log(
  `Novos Comer Fora: ${avg((r) => r.novosComerFora).toFixed(0)} usuários (${avg((r) => r.novosComerForaPct).toFixed(1)}% da base)`,
);
console.log(
  `Δ Lucro líquido (painel): R$ ${avg((r) => r.lucroLiquidoDelta).toFixed(0)} (+${avg((r) => r.lucroLiquidoPct).toFixed(1)}%)`,
);
console.log(
  `Δ GMV: R$ ${avg((r) => r.gmvDeltaAbs).toFixed(0)} (+${avg((r) => r.gmvDeltaPct).toFixed(1)}%)`,
);
console.log(
  `ROI médio: ${avg((r) => r.roi).toFixed(2)}x | Lift vs controle: +${avg((r) => r.liftVsControlPct).toFixed(1)} pp`,
);
console.log(
  `Parceiro Δ lucro CF vs trad: R$ ${avg((r) => r.partner.lucroCfVsTrad).toFixed(0)}/mês`,
);
console.log(
  `Parceiro Δ lucro CF+benef vs trad: R$ ${avg((r) => r.partner.lucroBenVsTrad).toFixed(0)}/mês`,
);
console.log(
  `Parceiro Δ recorrência: +${avg((r) => r.partner.recDeltaPp).toFixed(1)} pp`,
);
console.log(
  `Retenção D30 gift vs controle: +${avg((r) => r.ret30.giftVsCtrlPp).toFixed(1)} pp`,
);
