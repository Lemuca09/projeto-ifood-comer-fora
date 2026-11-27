import { GUARD_THRESHOLDS } from "@/guardrails/config";

export type GuardDecision = "permitir" | "sanitizar" | "degradar" | "bloquear";

export type GuardResult = {
  decisao: GuardDecision;
  score: number;
  ruleIds: string[];
  textoSeguro: string;
};

const RULES: Array<{ id: string; re: RegExp; score: number }> = [
  { id: "ignore_instructions", re: /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i, score: 70 },
  { id: "ignore_pt", re: /ignore\s+(todas?\s+)?(as\s+)?instru/i, score: 70 },
  { id: "substituir_instrucoes", re: /substitu(a|ir)\s+(todas?\s+)?(as\s+)?instru/i, score: 70 },
  { id: "role_play", re: /(you\s+are\s+now|você\s+agora\s+é|developer\s+mode|modo\s+desenvolvedor|\bDAN\b)/i, score: 70 },
  { id: "extract_prompt", re: /(reveal|show|print|exiba|mostre|diga).{0,40}(system\s+prompt|prompt\s+do\s+sistema|canary)/i, score: 70 },
  { id: "fake_tags", re: /<\/?\s*(system|assistant|instruction)\s*>/i, score: 40 },
  { id: "delimiter_fake", re: /(-{3,}\s*)?(SYSTEM|INSTRUÇÃO|INSTRUCAO)\s*(-{3,})?/i, score: 40 },
  { id: "base64_blob", re: /(?:[A-Za-z0-9+/]{40,}={0,2})/, score: 20 },
  { id: "leetspeak_jail", re: /1gn0r[e3].{0,20}1nstru/i, score: 40 },
  { id: "many_shot", re: /(?:user:|assistant:)(?:[\s\S]*?(?:user:|assistant:)){5,}/i, score: 40 },
  { id: "inverted_hint", re: /texto\s+invertido|reverse\s+the\s+prompt/i, score: 40 },
];

/** Pares confundíveis comuns (homóglifos) → ASCII. */
const HOMOGLYPH_MAP: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x",
  і: "i", ѕ: "s", Α: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X",
};

function mapHomoglyphs(s: string): string {
  return [...s].map((ch) => HOMOGLYPH_MAP[ch] ?? ch).join("");
}

function stripControls(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\uFEFF]/g, "");
}

function tryDecodeBase64Layers(text: string, depth = 0): string[] {
  const out = [text];
  if (depth >= 2) return out;
  const m = text.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? [];
  for (const chunk of m.slice(0, 5)) {
    if (chunk.length > 2_000) continue;
    try {
      const decoded = Buffer.from(chunk, "base64").toString("utf8");
      if (decoded && /[\x20-\x7E\u00C0-\u024F]{4,}/.test(decoded)) {
        out.push(...tryDecodeBase64Layers(decoded, depth + 1));
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

function mixedScriptScore(text: string): number {
  const hasLatin = /[A-Za-z]/.test(text);
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  return hasLatin && hasCyrillic ? 40 : 0;
}

export function inputGuard(raw: string): GuardResult {
  const textoSeguro = stripControls(raw).trim().slice(0, 500);
  let score = 0;
  const ruleIds: string[] = [];

  const variants = new Set<string>([
    textoSeguro,
    mapHomoglyphs(textoSeguro),
    textoSeguro.split("").reverse().join(""),
    ...tryDecodeBase64Layers(textoSeguro),
  ]);

  for (const variant of variants) {
    for (const rule of RULES) {
      if (rule.re.test(variant) && !ruleIds.includes(rule.id)) {
        score += rule.score;
        ruleIds.push(rule.id);
      }
    }
  }

  const mixed = mixedScriptScore(textoSeguro);
  if (mixed && !ruleIds.includes("mixed_script")) {
    score += mixed;
    ruleIds.push("mixed_script");
  }

  let decisao: GuardDecision;
  if (score >= GUARD_THRESHOLDS.bloquearMin) decisao = "bloquear";
  else if (score >= GUARD_THRESHOLDS.degradarMax - 29) decisao = "degradar";
  else if (score >= 1) decisao = "sanitizar";
  else decisao = "permitir";

  return { decisao, score, ruleIds, textoSeguro };
}
