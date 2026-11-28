import { DISHES_BY_CUISINE } from "@/domain/analytics/dishes";
import type { MenuItem } from "@/domain/dineOut/types";

const DRINKS = [
  { name: "Água com gás", priceBrl: 8, prepMin: 1 },
  { name: "Refrigerante lata", priceBrl: 10, prepMin: 1 },
  { name: "Suco natural", priceBrl: 16, prepMin: 4 },
  { name: "Chopp 400ml", priceBrl: 18, prepMin: 2 },
];

const DESSERTS = [
  { name: "Petit gateau", priceBrl: 28, prepMin: 12 },
  { name: "Pudim da casa", priceBrl: 18, prepMin: 2 },
  { name: "Sorvete 2 bolas", priceBrl: 16, prepMin: 2 },
];

/** Infere culinária pelo nome/descrição do restaurante (seed sintético). */
export function inferCuisine(
  restaurantName: string,
  description?: string | null,
): string {
  const n = `${restaurantName} ${description ?? ""}`.toLowerCase();
  if (
    /lamen|ramen|lám|l[aá]men|sushi|sashimi|nikkei|temaki|japon|yakisoba|missoshiro|tempu?ra/.test(
      n,
    )
  ) {
    return "Japonesa";
  }
  if (/burger|smash|hamb/.test(n)) return "Hambúrguer";
  if (
    /cantina|pizza|trattoria|italia|itali|nhoque|pasta|risoto|massa/.test(n)
  ) {
    return "Italiana";
  }
  if (/esfiha|árabe|arabe|kibe|shawarma|liban|siria|síria/.test(n)) {
    return "Árabe";
  }
  if (
    /doce|caf[eé]|ceia|confeit|sobremesa|padaria|doceria|brunch/.test(n)
  ) {
    return "Café";
  }
  if (
    /buddha|veggie|\bveg\b|vegetari|vegana|plant.?based|falafel|gr[aã]o.?de.?bico/.test(
      n,
    )
  ) {
    return "Vegetariana";
  }
  if (
    /churras|espetinho|picanha|churrasquinho|grelhad|steak|costela|brasileir/.test(
      n,
    )
  ) {
    return "Brasileira";
  }
  return "Brasileira";
}

/** Prato grátis coerente com a culinária do restaurante (determinístico). */
export function freeDishForRestaurant(
  restaurantName: string,
  description?: string | null,
  salt = "",
): { name: string; typicalPriceBrl: number } {
  const cuisine = inferCuisine(restaurantName, description);
  const pool = DISHES_BY_CUISINE[cuisine] ?? DISHES_BY_CUISINE.Brasileira;
  const key = `${restaurantName}|${description ?? ""}|${salt}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return pool[h % pool.length]!;
}

export function buildMenu(cuisine: string, restaurantId: string): MenuItem[] {
  const dishes = DISHES_BY_CUISINE[cuisine] ?? DISHES_BY_CUISINE.Brasileira;
  const items: MenuItem[] = [];

  dishes.forEach((d, i) => {
    items.push({
      id: `${restaurantId}:prato:${i}`,
      name: d.name,
      priceBrl: d.typicalPriceBrl,
      category: "prato",
      prepMin: 12 + (i % 4) * 3,
    });
  });

  DRINKS.forEach((d, i) => {
    items.push({
      id: `${restaurantId}:bebida:${i}`,
      name: d.name,
      priceBrl: d.priceBrl,
      category: "bebida",
      prepMin: d.prepMin,
    });
  });

  DESSERTS.forEach((d, i) => {
    items.push({
      id: `${restaurantId}:sobremesa:${i}`,
      name: d.name,
      priceBrl: d.priceBrl,
      category: "sobremesa",
      prepMin: d.prepMin,
    });
  });

  return items;
}
