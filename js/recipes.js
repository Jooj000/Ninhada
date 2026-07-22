/* =====================================================================
 * recipes.js — DADOS DA COZINHA (ingredientes, comidas, receitas)
 * ---------------------------------------------------------------------
 * Só dados + a função que casa uma dupla de ingredientes com uma receita.
 * Emojis são placeholders; troque por .png depois (assets/ui/ ou nova
 * pasta assets/food/) usando o mesmo esquema do assets-map.
 * ===================================================================== */

import { BALANCE } from "./balance.js";

const K = BALANCE.kitchen;
const mp = (v) => Math.max(1, Math.round(v * K.foodPriceMultiplier));

/* Comida pronta: SÓ sacia a fome (sem XP). Comprada na hora. */
export const READY_FOODS = [
  { id: "mamadeira", label: "Mamadeira", emoji: "🍼", hunger: 30, cost: mp(6), xp: Math.round(6 * K.readyFoodXpMultiplier) },
  { id: "papinha",   label: "Papinha",   emoji: "🍚", hunger: 25, cost: mp(5), xp: Math.round(5 * K.readyFoodXpMultiplier) },
];

/* Ingredientes crus: combine 2 na panela pra cozinhar (dá XP). */
export const INGREDIENTS = [
  { id: "leite",   label: "Leite",   emoji: "🥛", cost: mp(8)  },
  { id: "banana",  label: "Banana",  emoji: "🍌", cost: mp(6)  },
  { id: "cereal",  label: "Cereal",  emoji: "🥣", cost: mp(10) },
  { id: "maca",    label: "Maçã",    emoji: "🍎", cost: mp(6)  },
  { id: "cenoura", label: "Cenoura", emoji: "🥕", cost: mp(7)  },
];

/* Fallback caso um ingrediente não tenha preço próprio. */
export const INGREDIENT_COST = mp(8);

/* Receitas conhecidas: dupla de ingredientes -> prato (fome + XP).
 * IMPORTANTE: `id` é usado como CHAVE no Firebase, então é sempre ASCII
 * (sem acento/espaço). O nome bonito fica em `label`. */
export const RECIPES = [
  { id: "vitamina",    label: "Vitamina",       emoji: "🥤", need: ["leite", "banana"],   hunger: 45, xp: Math.round(55 * K.cookXpMultiplier) },
  { id: "mingau",      label: "Mingau",         emoji: "🍮", need: ["leite", "cereal"],   hunger: 50, xp: Math.round(70 * K.cookXpMultiplier) },
  { id: "papa_frutas", label: "Papa de Frutas", emoji: "🍧", need: ["banana", "maca"],    hunger: 40, xp: Math.round(45 * K.cookXpMultiplier) },
  { id: "sopinha",     label: "Sopinha",        emoji: "🍲", need: ["cenoura", "cereal"], hunger: 48, xp: Math.round(62 * K.cookXpMultiplier) },
  { id: "pure",        label: "Purê",           emoji: "🥔", need: ["cenoura", "maca"],   hunger: 42, xp: Math.round(50 * K.cookXpMultiplier) },
];

/* Combo desconhecido: ainda alimenta um pouco, mas quase sem XP. */
export const UNKNOWN_DISH = { id: null, label: "Papa simples", emoji: "🥄", hunger: 20, xp: Math.round(10 * K.cookXpMultiplier) };

/* Casa uma dupla de ids de ingredientes com uma receita (ordem não importa). */
export function matchRecipe(a, b) {
  const key = [a, b].sort().join("+");
  for (const r of RECIPES) {
    if (r.need.slice().sort().join("+") === key) return r;
  }
  return null;
}
