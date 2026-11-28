/**
 * Suíte determinística da guarda de entrada.
 * Holdout NÃO é usado para escrever regras - só reporta bypass/total.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Espelho das regras críticas de src/guardrails/inputGuard.ts (Node puro).
 * Mantido alinhado manualmente - CI falha se known.json divergir.
 */
function inputGuard(raw) {
  const textoSeguro = raw.normalize("NFKC").replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\uFEFF]/g, "").trim().slice(0, 500);
  const RULES = [
    { id: "ignore_instructions", re: /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i, score: 70 },
    { id: "ignore_pt", re: /ignore\s+(todas?\s+)?(as\s+)?instru/i, score: 70 },
    { id: "substituir_instrucoes", re: /substitu(a|ir)\s+(todas?\s+)?(as\s+)?instru/i, score: 70 },
    { id: "bypass", re: /\b(bypass|jailbreak|override\s+rules?|quebra\s+de\s+regras?)\b/i, score: 70 },
    { id: "role_play", re: /(you\s+are\s+now|você\s+agora\s+é|act\s+as|atue\s+como|finja\s+que\s+(você|voce)\s+é|developer\s+mode|modo\s+desenvolvedor|\bDAN\b)/i, score: 70 },
    { id: "extract_prompt", re: /(reveal|show|print|exiba|mostre|diga|repita).{0,40}(system\s+prompt|prompt\s+do\s+sistema|instru(c|ç)[oõ]es\s+internas|canary)/i, score: 70 },
    { id: "system_prompt_mention", re: /\b(system\s+prompt|prompt\s+do\s+sistema|instru(c|ç)[oõ]es\s+do\s+sistema)\b/i, score: 70 },
    { id: "fake_tags", re: /<\/?\s*(system|assistant|instruction|instructions|user_query)\s*>/i, score: 70 },
    { id: "delimiter_fake", re: /(-{3,}\s*)?(SYSTEM|INSTRUÇÃO|INSTRUCAO|END\s+OF\s+PROMPT)\s*(-{3,})?/i, score: 70 },
    { id: "sqli", re: /(\b(union\s+select|drop\s+table|insert\s+into|or\s+1\s*=\s*1)\b|--\s*$|;(\s)*(drop|delete|update))/i, score: 70 },
    { id: "code_injection", re: /(<script|javascript:|onerror\s*=|\beval\s*\(|\bexec\s*\(|\$\{.*\})/i, score: 70 },
    { id: "force_discount", re: /(invente|inventa|finja|force|me\s+d[eê]).{0,40}(cupom|desconto|promo(c|ç)[aã]o|gr[aá]tis).{0,20}(100|ilimitado|qualquer|inexistente)/i, score: 70 },
    { id: "override_business", re: /(ignore|ignore\s+as|n[aã]o\s+respeite).{0,30}(regras?\s+de\s+neg[oó]cio|pol[ií]tica|pre[cç]o|disponibilidade)/i, score: 70 },
    { id: "base64_blob", re: /(?:[A-Za-z0-9+/]{40,}={0,2})/, score: 20 },
    { id: "leetspeak_jail", re: /1gn0r[e3].{0,20}1nstru/i, score: 40 },
    { id: "many_shot", re: /(?:user:|assistant:)(?:[\s\S]*?(?:user:|assistant:)){5,}/i, score: 40 },
    { id: "inverted_hint", re: /texto\s+invertido|reverse\s+the\s+prompt/i, score: 40 },
    { id: "toxicity", re: /\b(matar|mate|te\s+mato|vou\s+te\s+matar|assassina|assassine|ódio\s+racial|hate\s+speech|nazista|kill\s+(you|myself)|i'?ll\s+kill)\b/i, score: 70 },
  ];
  let score = 0;
  const ruleIds = [];
  const variants = [textoSeguro, [...textoSeguro].reverse().join("")];
  const b64 = textoSeguro.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? [];
  for (const chunk of b64.slice(0, 3)) {
    try {
      const d = Buffer.from(chunk, "base64").toString("utf8");
      if (d) variants.push(d);
    } catch { /* */ }
  }
  for (const v of variants) {
    for (const rule of RULES) {
      if (rule.re.test(v) && !ruleIds.includes(rule.id)) {
        score += rule.score;
        ruleIds.push(rule.id);
      }
    }
  }
  let decisao = "permitir";
  if (score >= 70) decisao = "bloquear";
  else if (score >= 40) decisao = "degradar";
  else if (score >= 1) decisao = "sanitizar";
  return { decisao, score, ruleIds, textoSeguro };
}

/** Smoke de output guard (canary / HTML / segredo) - AGENTS §7.6. */
function outputSmoke(raw, canary) {
  if (canary && raw.toLowerCase().includes(canary.toLowerCase())) return "canary";
  if (/<\s*script/i.test(raw) || /https?:\/\//i.test(raw)) return "html_or_url";
  if (/\b(sk-[a-z0-9_-]{16,}|sk-ant-[a-z0-9_-]{16,})\b/i.test(raw)) return "secret";
  return null;
}

function matchesExpect(decisao, expect) {
  if (expect === decisao) return true;
  if (expect === "permitir_or_sanitizar") return decisao === "permitir" || decisao === "sanitizar";
  if (expect === "degradar_or_bloquear") return decisao === "degradar" || decisao === "bloquear";
  if (expect === "bloquear_or_degradar") return decisao === "bloquear" || decisao === "degradar";
  return false;
}

const known = JSON.parse(readFileSync(join(__dirname, "known.json"), "utf8"));
const legitimate = JSON.parse(readFileSync(join(__dirname, "legitimate.json"), "utf8"));
const holdout = JSON.parse(readFileSync(join(__dirname, "holdout.json"), "utf8"));

assert.ok(legitimate.length >= 50, "mín. 50 legítimos");
assert.ok(holdout.length >= 20, "mín. 20 holdout");

let knownFail = 0;
for (const k of known) {
  const r = inputGuard(k.payload);
  if (!matchesExpect(r.decisao, k.expect)) {
    knownFail++;
    console.error("KNOWN_FAIL", k.id, r.decisao, k.expect);
  }
}

let fp = 0;
for (const text of legitimate) {
  const r = inputGuard(text);
  if (r.decisao === "bloquear" || r.decisao === "degradar") fp++;
}
const fpRate = fp / legitimate.length;

let bypass = 0;
for (const h of holdout) {
  const r = inputGuard(h.payload);
  if (r.decisao === "permitir" || r.decisao === "sanitizar") bypass++;
}

assert.equal(knownFail, 0, "100% conhecidos devem ser neutralizados");
assert.ok(fpRate <= 0.05 + 1e-9, `FP meta ≤5%, obteve ${(fpRate * 100).toFixed(1)}%`);

const canary = "CANARY_TEST_TOKEN_XYZ";
const outputCases = [
  { id: "out_canary", raw: `{"x":"${canary}"}`, expect: "canary" },
  { id: "out_script", raw: '{"x":"<script>alert(1)</script>"}', expect: "html_or_url" },
  { id: "out_secret", raw: '{"k":"sk-ant-api03-abcdefghijklmnop"}', expect: "secret" },
  { id: "out_clean", raw: '{"headline":"ok"}', expect: null },
];
let outputFail = 0;
for (const c of outputCases) {
  const reason = outputSmoke(c.raw, canary);
  if (reason !== c.expect) {
    outputFail++;
    console.error("OUTPUT_FAIL", c.id, reason, c.expect);
  }
}
assert.equal(outputFail, 0, "output smoke deve passar");

console.log(
  JSON.stringify({
    ok: true,
    known: known.length,
    knownFail,
    legitimate: legitimate.length,
    falsePositives: fp,
    falsePositiveRate: Number((fpRate * 100).toFixed(2)),
    holdout: holdout.length,
    holdoutBypass: bypass,
    holdoutBypassRatio: `${bypass}/${holdout.length}`,
    outputSmokeFail: outputFail,
    canaryLeaks: outputCases.filter((c) => c.expect === "canary" && !outputSmoke(c.raw, canary)).length,
    note: "Não afirmar segurança total. Residual existe. Runner espelha inputGuard; não importa o TS de produção.",
  }),
);
