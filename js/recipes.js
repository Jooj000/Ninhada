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
  { id: "mamadeira", label: "Mamadeira", emoji: "🍼", hunger: 30, cost: mp(6),  xp: Math.round(6 * K.readyFoodXpMultiplier) },
  { id: "papinha",   label: "Papinha",   emoji: "🍚", hunger: 25, cost: mp(5),  xp: Math.round(5 * K.readyFoodXpMultiplier) },
  { id: "biscoito",  label: "Biscoito",  emoji: "🍪", hunger: 18, cost: mp(4),  xp: Math.round(4 * K.readyFoodXpMultiplier) },
  { id: "iogurte",   label: "Iogurte",   emoji: "🥛", hunger: 28, cost: mp(7),  xp: Math.round(7 * K.readyFoodXpMultiplier) },
  { id: "fruta",     label: "Fruta",     emoji: "🍎", hunger: 22, cost: mp(5),  xp: Math.round(6 * K.readyFoodXpMultiplier) },
  { id: "suco",      label: "Suquinho",  emoji: "🧃", hunger: 20, cost: mp(6),  xp: Math.round(5 * K.readyFoodXpMultiplier) },
  { id: "pao",       label: "Pãozinho",  emoji: "🥐", hunger: 32, cost: mp(9),  xp: Math.round(8 * K.readyFoodXpMultiplier) },
  { id: "sanduiche", label: "Sanduíche", emoji: "🥪", hunger: 40, cost: mp(13), xp: Math.round(10 * K.readyFoodXpMultiplier) },
];

/* Ingredientes crus: combine 2 na panela pra cozinhar (dá XP). */
export const INGREDIENTS = [
  { id: "leite",    label: "Leite",    emoji: "🥛", cost: mp(8)  },
  { id: "banana",   label: "Banana",   emoji: "🍌", cost: mp(6)  },
  { id: "cereal",   label: "Cereal",   emoji: "🥣", cost: mp(10) },
  { id: "maca",     label: "Maçã",     emoji: "🍎", cost: mp(6)  },
  { id: "cenoura",  label: "Cenoura",  emoji: "🥕", cost: mp(7)  },
  { id: "morango",  label: "Morango",  emoji: "🍓", cost: mp(9)  },
  { id: "abobora",  label: "Abóbora",  emoji: "🎃", cost: mp(8)  },
  { id: "batata",   label: "Batata",   emoji: "🥔", cost: mp(7)  },
  { id: "ovo",      label: "Ovo",      emoji: "🥚", cost: mp(9)  },
  { id: "mel",      label: "Mel",      emoji: "🍯", cost: mp(12) },
  { id: "arroz",    label: "Arroz",    emoji: "🍚", cost: mp(7)  },
  { id: "frango",   label: "Frango",   emoji: "🍗", cost: mp(15) },
  { id: "chocolate",label: "Chocolate",emoji: "🍫", cost: mp(14) },
  { id: "aveia",    label: "Aveia",    emoji: "🌾", cost: mp(9)  },
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
  { id: "pure",        label: "Purê",           emoji: "🥔", need: ["cenoura", "maca"],       hunger: 42, xp: Math.round(50 * K.cookXpMultiplier) },

  /* --- receitas novas --- */
  { id: "vit_morango", label: "Vitamina de Morango", emoji: "🥤", need: ["leite", "morango"],   hunger: 46, xp: Math.round(58 * K.cookXpMultiplier) },
  { id: "mingau_aveia",label: "Mingau de Aveia",     emoji: "🥣", need: ["leite", "aveia"],     hunger: 52, xp: Math.round(72 * K.cookXpMultiplier) },
  { id: "creme_abobora",label:"Creme de Abóbora",    emoji: "🍜", need: ["abobora", "cenoura"], hunger: 50, xp: Math.round(66 * K.cookXpMultiplier) },
  { id: "pure_batata", label: "Purê de Batata",      emoji: "🥔", need: ["batata", "leite"],    hunger: 48, xp: Math.round(60 * K.cookXpMultiplier) },
  { id: "omelete",     label: "Omelete",             emoji: "🍳", need: ["ovo", "batata"],      hunger: 55, xp: Math.round(78 * K.cookXpMultiplier) },
  { id: "canjinha",    label: "Canjinha",            emoji: "🍲", need: ["arroz", "frango"],    hunger: 60, xp: Math.round(90 * K.cookXpMultiplier) },
  { id: "arroz_doce",  label: "Arroz Doce",          emoji: "🍮", need: ["arroz", "leite"],     hunger: 47, xp: Math.round(64 * K.cookXpMultiplier) },
  { id: "banana_mel",  label: "Banana com Mel",      emoji: "🍌", need: ["banana", "mel"],      hunger: 38, xp: Math.round(48 * K.cookXpMultiplier) },
  { id: "brigadeirinho",label:"Brigadeirinho",       emoji: "🍫", need: ["chocolate", "leite"], hunger: 44, xp: Math.round(56 * K.cookXpMultiplier) },
  { id: "bolo_cenoura",label: "Bolo de Cenoura",     emoji: "🍰", need: ["cenoura", "chocolate"],hunger: 52, xp: Math.round(80 * K.cookXpMultiplier) },
  { id: "papa_aveia",  label: "Papa de Aveia e Maçã",emoji: "🍏", need: ["aveia", "maca"],      hunger: 45, xp: Math.round(58 * K.cookXpMultiplier) },
  { id: "ovo_frango",  label: "Bolinho de Frango",   emoji: "🍢", need: ["ovo", "frango"],      hunger: 58, xp: Math.round(86 * K.cookXpMultiplier) },
  { id: "vit_abobora", label: "Doce de Abóbora",     emoji: "🍠", need: ["abobora", "mel"],     hunger: 43, xp: Math.round(54 * K.cookXpMultiplier) },
  { id: "salada_frutas",label:"Salada de Frutas",    emoji: "🍨", need: ["morango", "maca"],    hunger: 40, xp: Math.round(50 * K.cookXpMultiplier) },
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
