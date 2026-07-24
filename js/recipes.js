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
/* `efeitos` (todos opcionais):
 *   sleep/love/health  -> pontos somados no status
 *   doce: true         -> conta no limite diário de doces
 *   gordura: true      -> tira saúde na hora
 *   limiteDia: n       -> só pode consumir n vezes por dia
 *   contador: "cafes"  -> qual contador diário usar
 */
export const READY_FOODS = [
  { id: "mamadeira", label: "Mamadeira", emoji: "🍼", hunger: 30, cost: mp(6),  xp: Math.round(6 * K.readyFoodXpMultiplier) },
  { id: "papinha",   label: "Papinha",   emoji: "🍚", hunger: 25, cost: mp(5),  xp: Math.round(5 * K.readyFoodXpMultiplier) },
  { id: "biscoito",  label: "Biscoito",  emoji: "🍪", hunger: 18, cost: mp(4),  xp: Math.round(4 * K.readyFoodXpMultiplier) },
  { id: "iogurte",   label: "Iogurte",   emoji: "🥛", hunger: 28, cost: mp(7),  xp: Math.round(7 * K.readyFoodXpMultiplier) },
  { id: "fruta",     label: "Fruta",     emoji: "🍎", hunger: 22, cost: mp(5),  xp: Math.round(6 * K.readyFoodXpMultiplier) },
  { id: "suco",      label: "Suquinho",  emoji: "🧃", hunger: 20, cost: mp(6),  xp: Math.round(5 * K.readyFoodXpMultiplier) },
  { id: "pao",       label: "Pãozinho",  emoji: "🥐", hunger: 32, cost: mp(9),  xp: Math.round(8 * K.readyFoodXpMultiplier) },
  { id: "sanduiche", label: "Sanduíche", emoji: "🥪", hunger: 40, cost: mp(13), xp: Math.round(10 * K.readyFoodXpMultiplier) },

  /* --- comidas com EFEITO --- */
  { id: "barra_cereal", label: "Barra de Cereal", emoji: "🍫", hunger: 14, cost: mp(9),
    xp: 5, efeitos: { sleep: 5 } },
  { id: "cafe", label: "Café com Leite", emoji: "☕", hunger: 8, cost: mp(11),
    xp: 4, efeitos: { sleep: 10, limiteDia: 2, contador: "cafes" } },
  { id: "sopa", label: "Sopa Quentinha", emoji: "🍜", hunger: 35, cost: mp(16),
    xp: 12, efeitos: { health: 8 } },
  { id: "vitamina_pronta", label: "Vitamina", emoji: "🥤", hunger: 28, cost: mp(15),
    xp: 10, efeitos: { health: 10 } },
  { id: "picole", label: "Picolé", emoji: "🍧", hunger: 8, cost: mp(8),
    xp: 3, efeitos: { love: 24, doce: true } },
  { id: "bolinho", label: "Bolinho", emoji: "🧁", hunger: 12, cost: mp(10),
    xp: 4, efeitos: { love: 15, doce: true } },
  { id: "batata_frita", label: "Batata Frita", emoji: "🍟", hunger: 34, cost: mp(12),
    xp: 4, efeitos: { gordura: true, health: -6 } },
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
  { id: "mel",      label: "Mel",      emoji: "🍯", cost: mp(8)  },
  { id: "arroz",    label: "Arroz",    emoji: "🍚", cost: mp(7)  },
  { id: "frango",   label: "Frango",   emoji: "🍗", cost: mp(11) },
  { id: "chocolate",label: "Chocolate",emoji: "🍫", cost: mp(10) },
  { id: "aveia",    label: "Aveia",    emoji: "🌾", cost: mp(9)  },
];

/* Fallback caso um ingrediente não tenha preço próprio. */
export const INGREDIENT_COST = mp(8);

/* Receitas conhecidas: dupla de ingredientes -> prato (fome + XP).
 * IMPORTANTE: `id` é usado como CHAVE no Firebase, então é sempre ASCII
 * (sem acento/espaço). O nome bonito fica em `label`. */
export const RECIPES = [
  { id: "vitamina",    label: "Vitamina",       emoji: "🥤", need: ["leite", "banana"],   hunger: 45, xp: Math.round(55 * K.cookXpMultiplier), efeitos: { health: 8 } },
  { id: "mingau",      label: "Mingau",         emoji: "🍮", need: ["leite", "cereal"],   hunger: 50, xp: Math.round(70 * K.cookXpMultiplier), efeitos: { health: 7 } },
  { id: "papa_frutas", label: "Papa de Frutas", emoji: "🍧", need: ["banana", "maca"],    hunger: 40, xp: Math.round(45 * K.cookXpMultiplier), efeitos: { health: 6 } },
  { id: "sopinha",     label: "Sopinha",        emoji: "🍲", need: ["cenoura", "cereal"], hunger: 48, xp: Math.round(62 * K.cookXpMultiplier), efeitos: { health: 9 } },
  { id: "pure",        label: "Purê",           emoji: "🥔", need: ["cenoura", "maca"],       hunger: 42, xp: Math.round(50 * K.cookXpMultiplier), efeitos: { health: 7 } },

  /* --- receitas novas --- */
  { id: "vit_morango", label: "Vitamina de Morango", emoji: "🥤", need: ["leite", "morango"],   hunger: 46, xp: Math.round(58 * K.cookXpMultiplier), efeitos: { health: 9 } },
  { id: "mingau_aveia",label: "Mingau de Aveia",     emoji: "🥣", need: ["leite", "aveia"],     hunger: 52, xp: Math.round(72 * K.cookXpMultiplier), efeitos: { health: 8 } },
  { id: "creme_abobora",label:"Creme de Abóbora",    emoji: "🍜", need: ["abobora", "cenoura"], hunger: 50, xp: Math.round(66 * K.cookXpMultiplier), efeitos: { health: 10 } },
  { id: "pure_batata", label: "Purê de Batata",      emoji: "🥔", need: ["batata", "leite"],    hunger: 48, xp: Math.round(60 * K.cookXpMultiplier), efeitos: { health: 8 } },
  { id: "omelete",     label: "Omelete",             emoji: "🍳", need: ["ovo", "batata"],      hunger: 55, xp: Math.round(78 * K.cookXpMultiplier), efeitos: { health: 9 } },
  { id: "canjinha",    label: "Canjinha",            emoji: "🍲", need: ["arroz", "frango"],    hunger: 60, xp: Math.round(90 * K.cookXpMultiplier), efeitos: { health: 12 } },
  { id: "arroz_doce",  label: "Arroz Doce",          emoji: "🍮", need: ["arroz", "leite"],     hunger: 47, xp: Math.round(64 * K.cookXpMultiplier), efeitos: { love: 22, doce: true } },
  { id: "banana_mel",  label: "Banana com Mel",      emoji: "🍌", need: ["banana", "mel"],      hunger: 46, xp: Math.round(48 * K.cookXpMultiplier) },
  { id: "brigadeirinho",label:"Brigadeirinho",       emoji: "🍫", need: ["chocolate", "leite"], hunger: 44, xp: Math.round(56 * K.cookXpMultiplier), efeitos: { love: 26, doce: true } },
  { id: "bolo_cenoura",label: "Bolo de Cenoura",     emoji: "🍰", need: ["cenoura", "chocolate"],hunger: 52, xp: Math.round(80 * K.cookXpMultiplier), efeitos: { love: 24, doce: true } },
  { id: "papa_aveia",  label: "Papa de Aveia e Maçã",emoji: "🍏", need: ["aveia", "maca"],      hunger: 45, xp: Math.round(58 * K.cookXpMultiplier), efeitos: { health: 7 } },
  { id: "ovo_frango",  label: "Bolinho de Frango",   emoji: "🍢", need: ["ovo", "frango"],      hunger: 58, xp: Math.round(86 * K.cookXpMultiplier), efeitos: { health: 10 } },
  { id: "vit_abobora", label: "Doce de Abóbora",     emoji: "🍠", need: ["abobora", "mel"],     hunger: 43, xp: Math.round(54 * K.cookXpMultiplier), efeitos: { love: 18, health: 6 } },
  { id: "salada_frutas",label:"Salada de Frutas",    emoji: "🍨", need: ["morango", "maca"],    hunger: 40, xp: Math.round(50 * K.cookXpMultiplier), efeitos: { health: 6 } },
];

/* Combo desconhecido: ainda alimenta um pouco, mas quase sem XP. */
export const UNKNOWN_DISH = { id: null, label: "Papa simples", emoji: "🥄", hunger: 20, xp: Math.round(10 * K.cookXpMultiplier) };

/* Casa uma dupla de ids de ingredientes com uma receita (ordem não importa). */
/* Descrição curtinha do item: só "+8 ❤️", "-6 ❤️", "+10 😴"… */
/* Descrição curta e padronizada de QUALQUER item (comida ou receita):
 *   a FOME vem sempre primeiro, depois XP e os demais status.
 *   Itens com limite diário mostram só "usados/limite".
 * `usados` vem do bebê (contadores do dia). */
export function descreverEfeitos(item, usados = 0) {
  if (!item) return "";
  const e = item.efeitos || {};
  const ICONE = { sleep: "😴", love: "💛", health: "❤️" };
  const partes = [];

  if (item.hunger) partes.push(`+${item.hunger} 🍗`);      // fome SEMPRE primeiro
  if (item.xp) partes.push(`+${item.xp} ⭐`);
  for (const k of ["health", "sleep", "love"]) {
    if (e[k]) partes.push(`${e[k] > 0 ? "+" : ""}${e[k]} ${ICONE[k]}`);
  }
  if (e.gordura && !e.health) partes.push("-4 ❤️");
  if (e.doce) partes.push("🍬");
  if (e.limiteDia) partes.push(`${usados}/${e.limiteDia}`);
  return partes.join(" · ");
}

export function matchRecipe(a, b) {
  const key = [a, b].sort().join("+");
  for (const r of RECIPES) {
    if (r.need.slice().sort().join("+") === key) return r;
  }
  return null;
}
