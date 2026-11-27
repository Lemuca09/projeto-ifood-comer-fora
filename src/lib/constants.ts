export const NEIGHBORHOODS = [
  "Gonzaga",
  "Boqueirão",
  "Ponta da Praia",
  "Embaré",
  "Aparecida",
] as const;

export const OCCASIONS = [
  { id: "jantar_a_dois", label: "Jantar a dois" },
  { id: "rapido", label: "Algo rápido" },
  { id: "grupo", label: "Com o grupo" },
  { id: "familia", label: "Em família" },
  { id: "especial", label: "Ocasião especial" },
] as const;

export const REASON_CODES = [
  "GOOD_MATCH",
  "PRICE_MATCH",
  "NEARBY",
  "AVAILABILITY",
  "POPULAR_CHOICE",
] as const;

export const REASON_LABELS: Record<(typeof REASON_CODES)[number], string> = {
  GOOD_MATCH: "Combina com a ocasião",
  PRICE_MATCH: "Cabe no orçamento",
  NEARBY: "Perto do bairro pedido",
  AVAILABILITY: "Tem vaga no horário",
  POPULAR_CHOICE: "Escolha popular na região",
};

/** Ticket médio por pessoa (sintético, para demo). */
export const PRICE_RANGES = [
  { value: 1, label: "Até R$ 40", short: "R$ 20–40", min: 20, max: 40 },
  { value: 2, label: "R$ 40–80", short: "R$ 40–80", min: 40, max: 80 },
  { value: 3, label: "R$ 80–150", short: "R$ 80–150", min: 80, max: 150 },
  { value: 4, label: "Acima de R$ 150", short: "R$ 150+", min: 150, max: null },
] as const;

export function priceRangeLabel(range: number, style: "label" | "short" = "short"): string {
  const found = PRICE_RANGES.find((p) => p.value === range);
  if (!found) return "-";
  return style === "label" ? found.label : found.short;
}
