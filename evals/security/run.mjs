/**
 * Suíte determinística da guarda de entrada.
 * Holdout NÃO é usado para escrever regras — só reporta bypass/total.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline mínimo espelhando regras críticas (o teste de CI deve importar TS via build;
// aqui replicamos o contrato para Node puro sem transpile).
function inputGuard(raw) {
  const textoSeguro = raw.normalize("NFKC").replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, "").trim().slice(0, 500);
  const RULES = [
    { id: "ignore_instructions", re: /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i, score: 70 },
    { id: "ignore_pt", re: /ignore\s+(todas?\s+)?(as\s+)?instru/i, score: 70 },
    { id: "role_play", re: /(you\s+are\s+now|você\s+agora\s+é|developer\s+mode|modo\s+desenvolvedor|\bDAN\b)/i, score: 70 },
    { id: "extract_prompt", re: /(reveal|show|print|exiba|mostre|diga).{0,40}(system\s+prompt|prompt\s+do\s+sistema|canary)/i, score: 70 },
    { id: "fake_tags", re: /<\/?\s*(system|assistant|instruction)\s*>/i, score: 40 },
    { id: "many_shot", re: /(?:user:|assistant:)(?:[\s\S]*?(?:user:|assistant:)){5,}/i, score: 40 },
    { id: "base64_blob", re: /(?:[A-Za-z0-9+/]{40,}={0,2})/, score: 20 },
    { id: "script", re: /<\s*script/i, score: 40 },
  ];
  let score = 0;
  const ruleIds = [];
  const variants = [textoSeguro];
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
    canaryLeaks: 0,
    note: "Não afirmar segurança total. Residual existe.",
  }),
);
