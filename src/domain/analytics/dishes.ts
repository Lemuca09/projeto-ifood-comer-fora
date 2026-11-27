/** Catálogo sintético de pratos por culinária — base do “prato grátis”. */

export const DISHES_BY_CUISINE: Record<
  string,
  Array<{ name: string; typicalPriceBrl: number }>
> = {
  Japonesa: [
    { name: "Combinado sashimi 12 peças", typicalPriceBrl: 68 },
    { name: "Hot roll salmão", typicalPriceBrl: 42 },
    { name: "Temaki Philadelphia", typicalPriceBrl: 28 },
    { name: "Yakisoba completo", typicalPriceBrl: 45 },
  ],
  Brasileira: [
    { name: "Picanha grelhada", typicalPriceBrl: 72 },
    { name: "Feijoada completa", typicalPriceBrl: 48 },
    { name: "Parmegiana de filé", typicalPriceBrl: 55 },
    { name: "Moqueca individual", typicalPriceBrl: 62 },
  ],
  Italiana: [
    { name: "Nhoque ao sugo", typicalPriceBrl: 44 },
    { name: "Risoto de funghi", typicalPriceBrl: 58 },
    { name: "Pizza margherita", typicalPriceBrl: 52 },
    { name: "Lasanha bolonhesa", typicalPriceBrl: 49 },
  ],
  "Hambúrguer": [
    { name: "Smash burger duplo", typicalPriceBrl: 38 },
    { name: "Burger bacon cheddar", typicalPriceBrl: 42 },
    { name: "Burger vegetariano", typicalPriceBrl: 36 },
    { name: "Combo burger + fritas", typicalPriceBrl: 48 },
  ],
  Árabe: [
    { name: "Esfiha aberta carne", typicalPriceBrl: 18 },
    { name: "Kibe assado", typicalPriceBrl: 22 },
    { name: "Mix de esfihas (6)", typicalPriceBrl: 45 },
    { name: "Beirute completo", typicalPriceBrl: 40 },
  ],
  Vegetariana: [
    { name: "Bowl buddha", typicalPriceBrl: 42 },
    { name: "Hambúrguer de grão-de-bico", typicalPriceBrl: 36 },
    { name: "Risoto de legumes", typicalPriceBrl: 48 },
    { name: "Salada completa proteica", typicalPriceBrl: 39 },
  ],
};

export type FavoriteDish = {
  name: string;
  typicalPriceBrl: number;
  purchaseSharePct: number;
};

/** Simula ranking dos pratos que a pessoa mais compra na culinária favorita. */
export function pickFavoriteDishes(
  cuisine: string,
  rnd: () => number,
  count = 3,
): FavoriteDish[] {
  const pool = DISHES_BY_CUISINE[cuisine] ?? DISHES_BY_CUISINE.Brasileira;
  const shuffled = [...pool].sort(() => rnd() - 0.5);
  const top = shuffled.slice(0, Math.min(count, shuffled.length));
  const raw = top.map(() => 0.35 + rnd());
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return top.map((d, i) => ({
    name: d.name,
    typicalPriceBrl: d.typicalPriceBrl,
    purchaseSharePct: Number(((raw[i] / sum) * 100).toFixed(1)),
  }));
}
