import type { CatalogRestaurant } from "@/services/restaurants";

/** Badges de ocasião - curadoria editorial (não inventam preço/slot). */
export const EXPERIENCE_BADGES = [
  "Date Romântico",
  "Turismo & História",
  "Almoço em Família",
  "Patrimônio Local",
  "Frutos do Mar",
  "Noite na Orla",
] as const;

export type ExperienceBadge = (typeof EXPERIENCE_BADGES)[number];

export type ExperienceTrail = {
  id: string;
  badge: ExperienceBadge;
  /** Título editorial; `{name}` = nome do restaurante. */
  title: string;
  /** Micro-storytelling (≤ 2 linhas na UI). */
  story: string;
  /** Tom visual do cover editorial. */
  cover: "sunset" | "harbor" | "heritage" | "family" | "seafood" | "night";
  priority: number;
  match: (r: CatalogRestaurant) => boolean;
};

function haystack(r: CatalogRestaurant): string {
  return `${r.name} ${r.description ?? ""} ${r.neighborhood} ${(r.occasion_tags ?? []).join(" ")}`.toLowerCase();
}

function hasTag(r: CatalogRestaurant, tag: string): boolean {
  return (r.occasion_tags ?? []).some((t) => t === tag);
}

/**
 * Trilhas editoriais de Santos - copy curada; o estabelecimento
 * e a disponibilidade vêm sempre do catálogo/slots reais.
 */
export const EXPERIENCE_TRAILS: ExperienceTrail[] = [
  {
    id: "date-historico",
    badge: "Date Romântico",
    title: "Agende seu date em {name}",
    story:
      "Mesa a dois com clima de orla santista - luz baixa, conversa longa e o Centro Histórico a um passeio.",
    cover: "sunset",
    priority: 10,
    match: (r) =>
      hasTag(r, "jantar_a_dois") ||
      /farol|bistrô|bistro|mirante|trattoria|osteria|enseada/.test(haystack(r)),
  },
  {
    id: "frutos-orla",
    badge: "Frutos do Mar",
    title: "Roteiro de frutos do mar em {name}",
    story:
      "Peixe fresco e brisa da baía - clássico da orla para quem quer sentir Santos no prato.",
    cover: "seafood",
    priority: 20,
    match: (r) =>
      /peix|anchova|sashimi|sushi|maré|mare|cais|bacalhau|moqueca|frutos/.test(
        haystack(r),
      ),
  },
  {
    id: "classicos-cidade",
    badge: "Patrimônio Local",
    title: "Clássico da cidade: {name}",
    story:
      "Casa com história de bairro - o tipo de mesa que os santistas indicam quando alguém pergunta “onde é bom de verdade?”.",
    cover: "heritage",
    priority: 30,
    match: (r) =>
      /cantina|vovó|vovo|caseir|trapiche|empório|emporio|padoca|nordeste/.test(
        haystack(r),
      ) || hasTag(r, "especial"),
  },
  {
    id: "turismo-historia",
    badge: "Turismo & História",
    title: "Pausa gastronômica em {name}",
    story:
      "Parada perfeita depois do porto, do museu ou do bondinho - turismo com mesa reservada, sem fila na porta.",
    cover: "harbor",
    priority: 40,
    match: (r) =>
      /gonzaga|ponta da praia|aparecida|mirante|estuario|estuário|farol|cais/.test(
        haystack(r),
      ) || r.price_range >= 3,
  },
  {
    id: "almoco-familia",
    badge: "Almoço em Família",
    title: "Mesa generosa em {name}",
    story:
      "Porções para compartilhar e ritmo de domingo - ideal quando a família inteira quer sair sem complicar.",
    cover: "family",
    priority: 50,
    match: (r) =>
      hasTag(r, "familia") ||
      hasTag(r, "grupo") ||
      /pizza|burger|churrasco|galeto|cantina|esfiha|falafel/.test(haystack(r)),
  },
  {
    id: "noite-orla",
    badge: "Noite na Orla",
    title: "Noite na orla começa em {name}",
    story:
      "Do pôr do sol à sobremesa - salão com vibe de calçadão e horário que cabe no seu jantar.",
    cover: "night",
    priority: 60,
    match: (r) =>
      /boqueirão|boqueirao|embaré|embare|orla|boteco|chop|bar /.test(
        haystack(r),
      ) || hasTag(r, "rapido"),
  },
];

export type CuratedExperience = {
  trailId: string;
  badge: ExperienceBadge;
  title: string;
  story: string;
  cover: ExperienceTrail["cover"];
  restaurant: CatalogRestaurant;
  /** Preferência geográfica: true se é o bairro do usuário. */
  inUserNeighborhood: boolean;
};

/**
 * Associa trilhas a restaurantes reais do catálogo.
 * Prioriza o bairro do usuário; completa com a cidade (Santos).
 * Um restaurante aparece no máximo em uma trilha.
 */
export function curateLocalExperiences(
  restaurants: CatalogRestaurant[],
  userNeighborhood: string,
  limit = 6,
): CuratedExperience[] {
  const active = restaurants.filter((r) => r.is_active);
  const used = new Set<string>();
  const out: CuratedExperience[] = [];

  const sortedTrails = [...EXPERIENCE_TRAILS].sort(
    (a, b) => a.priority - b.priority,
  );

  for (const trail of sortedTrails) {
    if (out.length >= limit) break;

    const candidates = active
      .filter((r) => !used.has(r.id) && trail.match(r))
      .sort((a, b) => {
        const aLocal = a.neighborhood === userNeighborhood ? 0 : 1;
        const bLocal = b.neighborhood === userNeighborhood ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
        return a.name.localeCompare(b.name, "pt-BR");
      });

    const pick = candidates[0];
    if (!pick) continue;

    used.add(pick.id);
    out.push({
      trailId: trail.id,
      badge: trail.badge,
      title: trail.title.replace("{name}", pick.name),
      story: trail.story,
      cover: trail.cover,
      restaurant: pick,
      inUserNeighborhood: pick.neighborhood === userNeighborhood,
    });
  }

  return out;
}
