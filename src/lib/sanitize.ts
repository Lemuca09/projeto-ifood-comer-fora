/** Normalização leve de texto livre (pt-BR). Sem HTML. */
export function sanitizeUserText(input: string, max = 500): string {
  const nfkc = input.normalize("NFKC");
  const noControls = nfkc.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, "");
  return noControls.trim().slice(0, max);
}

const PII_PATTERNS = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF-ish
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i,
  /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/,
];

export function stripLikelyPii(text: string): string {
  let out = text;
  for (const re of PII_PATTERNS) {
    out = out.replace(re, "[redacted]");
  }
  return out;
}
