/* =====================================================================
 * recipes.js — DADOS DA COZINHA (ingredientes, comidas, receitas)
 * ---------------------------------------------------------------------
 * Só dados + a função que casa uma dupla de ingredientes com uma receita.
 * Emojis são placeholders; troque por .png depois (assets/ui/ ou nova
 * pasta assets/food/) usando o mesmo esquema do assets-map.
 * ===================================================================== */

/* Comida pronta: SÓ sacia a fome (sem XP). Comprada na hora. */
export const READY_FOODS = [
  { id: "mamadeira", label: "Mamadeira", emoji: "🍼", hunger: 30, cost: 6 },
  { id: "papinha",   label: "Papinha",   emoji: "🍚", hunger: 25, cost: 5 },
];

/* Ingredientes crus: combine 2 na panela pra cozinhar (dá XP). */
export const INGREDIENTS = [
  { id: "leite",   label: "Leite",   emoji: "🥛" },
  { id: "banana",  label: "Banana",  emoji: "🍌" },
  { id: "cereal",  label: "Cereal",  emoji: "🥣" },
  { id: "maca",    label: "Maçã",    emoji: "🍎" },
  { id: "cenoura", label: "Cenoura", emoji: "🥕" },
];

export const INGREDIENT_COST = 3;   // por ingrediente colocado na panela

/* Receitas conhecidas: dupla de ingredientes -> prato (fome + XP).
 * IMPORTANTE: `id` é usado como CHAVE no Firebase, então é sempre ASCII
 * (sem acento/espaço). O nome bonito fica em `label`. */
export const RECIPES = [
  { id: "vitamina",    label: "Vitamina",       emoji: "🥤", need: ["leite", "banana"],   hunger: 45, xp: 15 },
  { id: "mingau",      label: "Mingau",         emoji: "🍮", need: ["leite", "cereal"],   hunger: 50, xp: 18 },
  { id: "papa_frutas", label: "Papa de Frutas", emoji: "🍧", need: ["banana", "maca"],    hunger: 40, xp: 12 },
  { id: "sopinha",     label: "Sopinha",        emoji: "🍲", need: ["cenoura", "cereal"], hunger: 48, xp: 16 },
  { id: "pure",        label: "Purê",           emoji: "🥔", need: ["cenoura", "maca"],   hunger: 42, xp: 14 },
];

/* Combo desconhecido: ainda alimenta um pouco, mas quase sem XP. */
export const UNKNOWN_DISH = { id: null, label: "Papa simples", emoji: "🥄", hunger: 20, xp: 3 };

/* Casa uma dupla de ids de ingredientes com uma receita (ordem não importa). */
export function matchRecipe(a, b) {
  const key = [a, b].sort().join("+");
  for (const r of RECIPES) {
    if (r.need.slice().sort().join("+") === key) return r;
  }
  return null;
}
