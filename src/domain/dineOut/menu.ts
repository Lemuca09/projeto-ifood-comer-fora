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

/** Infere culinária pelo nome do restaurante (seed sintético). */
export function inferCuisine(restaurantName: string): string {
  const n = restaurantName.toLowerCase();
  if (/sushi|nikkei|temaki|japon/.test(n)) return "Japonesa";
  if (/burger|smash|hamb/.test(n)) return "Hambúrguer";
  if (/pizza|trattoria|italia|nhoque|pasta/.test(n)) return "Italiana";
  if (/esfiha|árabe|arabe|kibe|shawarma/.test(n)) return "Árabe";
  if (/verde|veg|buddha|plant/.test(n)) return "Vegetariana";
  return "Brasileira";
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
