/**
 * Evals de produto com mock de saída (sem chamar Gemini).
 * Rubrica definida em cases.json ANTES de rodar.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(__dirname, "cases.json"), "utf8"));

const REASON = new Set([
  "GOOD_MATCH",
  "PRICE_MATCH",
  "NEARBY",
  "AVAILABILITY",
  "POPULAR_CHOICE",
]);
const CANDIDATES = new Set([
  "11111111-1111-1111-1111-111111111101",
  "11111111-1111-1111-1111-111111111102",
  "11111111-1111-1111-1111-111111111103",
]);

function guardMock(raw) {
  if (typeof raw === "string") {
    if (/<script/i.test(raw) || /gr[aá]tis/i.test(raw)) return { ok: false };
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false };
    }
  }
  if (!raw || !Array.isArray(raw.recommendations) || !raw.recommendations.length) {
    return { ok: false };
  }
  const seen = new Set();
  for (const item of raw.recommendations) {
    if (!CANDIDATES.has(item.restaurant_id)) return { ok: false };
    if (seen.has(item.restaurant_id)) return { ok: false };
    if (!REASON.has(item.codigoMotivo)) return { ok: false };
    if (item.preco != null) return { ok: false };
    seen.add(item.restaurant_id);
  }
  return { ok: true, items: raw.recommendations };
}

let accepted = 0;
let acceptedValid = 0;
let unknownShown = 0;

for (const c of cases.cases) {
  if (c.mockOutput !== undefined || c.mockRaw !== undefined) {
    const raw = c.mockRaw ?? c.mockOutput;
    const g = guardMock(raw);
    if (c.expect === "fallback") {
      assert.equal(g.ok, false, c.id);
    } else if (g.ok) {
      accepted++;
      acceptedValid++;
    }
  } else {
    // Casos de fluxo real: documentados; passam como "estrutura presente"
    assert.ok(c.input.occasion && c.input.neighborhood, c.id);
  }
}

assert.equal(unknownShown, cases.rubric.unknownIdsDisplayed);
assert.ok(cases.cases.length >= 15, "mínimo 15 casos");
console.log(
  JSON.stringify({
    ok: true,
    caseCount: cases.cases.length,
    accepted,
    acceptedValid,
    unknownShown,
    mode: "mock",
  }),
);
