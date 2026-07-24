/* =====================================================================
 * rooms.js — CÔMODOS MODIFICADORES DE STATUS
 * ---------------------------------------------------------------------
 * Cada status tem seu lugar de ser cuidado, sempre no BEBÊ ATIVO:
 *   COZINHA  -> fome  (comida pronta = só sacia; cozinhar = sacia + XP)
 *   BANHEIRO -> higiene (esfregar deslizando no bebê)
 *   QUARTO   -> sono  (apagar a luz e deixar dormir)
 *
 * updateRooms(room) é chamado pelo loop do game.js a cada frame; só
 * atualiza o cômodo que estiver aberto.
 * ===================================================================== */

import {
  serveFood, boostStatus, sootheNightmare,
} from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { GAME_CONFIG, BALANCE } from "./config.js";
import { registerCare } from "./streak.js";
import { giveMedicine } from "./firebase-sync.js";
import { applyDecay, moodFor } from "./state.js";
import { paintBabyLayers, buildStageLayers } from "./render-utils.js";
import {
  READY_FOODS, INGREDIENTS, RECIPES, INGREDIENT_COST, UNKNOWN_DISH, matchRecipe, descreverEfeitos,
} from "./recipes.js";

/* refs de cada palco de cômodo (montados uma vez) */
const stages = {};   // screenId -> { layers, stage, bar, label }
let pot = [];        // ingredientes na panela (máx 2)

function buildStage(containerId) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = `
    <div class="baby-stage room-stage" data-mood="happy"></div>
    <div class="bar"><div class="bar-fill room-bar-fill"></div><span class="bar-label room-bar-label"></span></div>`;
  const stage = wrap.querySelector(".baby-stage");
  return {
    stage,
    layers: buildStageLayers(stage, true),
    bar: wrap.querySelector(".room-bar-fill"),
    label: wrap.querySelector(".room-bar-label"),
  };
}

/* ------------------------------- COZINHA ------------------------------- */
function initKitchen() {
  stages["screen-kitchen"] = { ...buildStage("kitchen-baby"), statusKey: "hunger", statusName: "Saciedade" };

  // Comida pronta
  const readyRow = document.getElementById("ready-foods");
  READY_FOODS.forEach((f) => {
    const b = document.createElement("button");
    b.className = "food-btn";
    const efeito = descreverEfeitos(f);
    b.innerHTML = `<span class="food-emoji">${f.emoji}</span><span>${f.label}</span>`
      + `<small>${f.cost} 🪙</small>`
      + (efeito ? `<small class="food-efeito">${efeito}</small>` : "");
    b.onclick = () => { serveFood(getActiveBaby(), { hunger: f.hunger, xp: f.xp ?? GAME_CONFIG.xpPerCare, cost: f.cost, efeitos: f.efeitos || null }); registerCare(); };
    readyRow.appendChild(b);
  });

  // Ingredientes
  const ingRow = document.getElementById("ingredients");
  INGREDIENTS.forEach((ing) => {
    const b = document.createElement("button");
    b.className = "food-btn";
    b.innerHTML = `<span class="food-emoji">${ing.emoji}</span><span>${ing.label}</span><small>${ing.cost ?? INGREDIENT_COST} 🪙</small>`;
    b.onclick = () => addToPot(ing);
    ingRow.appendChild(b);
  });

  document.getElementById("cook-btn").onclick = cook;
  renderPot();
  renderRecipeBook();
}

function addToPot(ing) {
  if (pot.length >= 2) pot = [];          // recomeça se já cheia
  pot.push(ing);
  renderPot();
}

function renderPot() {
  const slots = document.getElementById("pot-slots");
  slots.innerHTML = pot.map((i) => `<span>${i.emoji}</span>`).join("") ||
    `<span class="pot-empty">arraste/toque 2 ingredientes</span>`;
  document.getElementById("cook-btn").disabled = pot.length !== 2;
}

async function cook() {
  if (pot.length !== 2) return;
  const recipe = matchRecipe(pot[0].id, pot[1].id) || UNKNOWN_DISH;
  const cost = pot.reduce((sum, i) => sum + (i.cost ?? INGREDIENT_COST), 0);

  // UM round rápido POR ingrediente (2 por refeição). Difícil de propósito.
  let total = 0;
  for (let i = 0; i < pot.length; i++) {
    const q = await playCookRound(pot[i], i + 1, pot.length);
    if (q === null) return;              // cancelou: não cozinha, mantém a panela
    total += q;
  }
  const quality = total / pot.length;

  // Fome sai mesmo mal (o bebê come), mas o XP recompensa a habilidade.
  const hunger = Math.round(recipe.hunger * (0.5 + 0.5 * quality));
  const xp = Math.round(recipe.xp * quality);
  const discovered = recipe.id && quality >= 0.5 ? recipe.id : null;

  await serveFood(getActiveBaby(), { hunger, xp, cost, recipeId: discovered, efeitos: recipe.efeitos || null });
  registerCare();

  const msg = document.getElementById("cook-msg");
  if (quality >= 0.85)     msg.textContent = `${recipe.emoji} ${recipe.label} perfeito! +${hunger} fome, +${xp} XP`;
  else if (quality >= 0.5) msg.textContent = `${recipe.emoji} ${recipe.label} no ponto! +${hunger} fome, +${xp} XP`;
  else                     msg.textContent = `😖 Queimou um pouco… +${hunger} fome, +${xp} XP`;

  pot = [];
  renderPot();
  renderRecipeBook();
}

/* Um round RÁPIDO do fogão para UM ingrediente. Toque único no ponto.
 * Resolve com a qualidade (0..1) ou null se cancelar (X). */
function playCookRound(ing, n, totalN) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("cook-game");
    const marker = document.getElementById("cook-marker");
    const tap = document.getElementById("cook-tap");
    const roundsEl = document.getElementById("cook-rounds");
    const titleEl = document.getElementById("cook-title");
    const cancel = document.getElementById("cook-cancel");

    let pos = Math.random() * 100;
    let dir = Math.random() < 0.5 ? 1 : -1;
    const speed = BALANCE.kitchen.cookSpeed;   // ver balance.js
    let raf = 0, done = false;

    titleEl.textContent = `Prepare ${ing.emoji} ${ing.label}`;
    roundsEl.textContent = `Ingrediente ${n} de ${totalN} — toque no verde!`;
    overlay.hidden = false;

    function loop() {
      pos += dir * speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      marker.style.left = `${pos}%`;
      raf = requestAnimationFrame(loop);
    }
    loop();

    function finish(result) {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      tap.removeEventListener("click", onTap);
      cancel.removeEventListener("click", onCancel);
      overlay.hidden = true;
      resolve(result);
    }
    function onTap() {
      const d = Math.abs(pos - 50);
      const q = d <= 7.5 ? 1 : d <= 18.5 ? 0.5 : 0;   // perfeito / ok / errou
      finish(q);
    }
    function onCancel() { finish(null); }

    tap.addEventListener("click", onTap);
    cancel.addEventListener("click", onCancel);
  });
}

function renderRecipeBook() {
  const book = document.getElementById("recipe-book");
  const known = (window.__STATE__ && window.__STATE__.recipes) || {};
  book.innerHTML = "";
  for (const r of RECIPES) {
    const found = !!known[r.id];
    const card = document.createElement("div");
    card.className = "recipe-card" + (found ? " found" : "");
    card.innerHTML = found
      ? `<span class="food-emoji">${r.emoji}</span><span>${r.label}</span>
         <small>${r.need.map((n) => INGREDIENTS.find((i) => i.id === n)?.emoji || "?").join(" + ")}</small>`
      : `<span class="food-emoji">❔</span><span>? ? ?</span><small>descubra cozinhando</small>`;
    book.appendChild(card);
  }
}

/* ------------------------------- LOOP --------------------------------
 * O banheiro e o quarto agora vivem DENTRO da cena (game.js). Aqui só
 * resta o menu de cozinhar, aberto pela faca na Cozinha. */
export function updateRooms(room) {
  if (!room || !room.babies) return;
  const baby = room.babies[getActiveBaby()];
  if (!baby) return;

  const screen = document.getElementById("screen-kitchen");
  if (!screen || !screen.classList.contains("active")) return;

  const s = stages["screen-kitchen"];
  if (!s) return;
  const decayed = applyDecay(baby, Date.now());
  paintBabyLayers(s.layers, decayed);
  s.stage.dataset.mood = moodFor(decayed);
  const val = Math.round(decayed[s.statusKey] ?? 0);
  s.bar.style.width = `${val}%`;
  s.bar.parentElement.dataset.low = val < 25 ? "true" : "false";
  s.label.textContent = `${s.statusName} ${val}%`;

  // caderno reflete receitas descobertas (inclusive por outro celular)
  renderRecipeBook();
}

export function initRooms() {
  initKitchen();
}
