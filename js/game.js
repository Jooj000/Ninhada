/* =====================================================================
 * game.js — CORE GAME LOOP + RENDER (multi-bebê, 2 modos de visão)
 * ---------------------------------------------------------------------
 * Modo "ver um":  seletor no topo escolhe o bebê; mostra 1 card completo.
 * Modo "cômodo":  todos os bebês distribuídos na cena; toque num deles
 *                 para selecioná-lo e voltar ao card completo.
 *
 * Diversão: não é mais um botão de cuidado. O botão "Brincar" leva ao
 * hub de minigames COM aquele bebê ativo; terminar uma rodada anima ele.
 * ===================================================================== */

import {
  initSync, onStateChange, syncDecay, addBaby, renameBaby,
} from "./firebase-sync.js";
import { ASSETS } from "./assets-map.js";
import { GAME_CONFIG, ROOM_NAME } from "./config.js";
import {
  STATUS_KEYS, applyDecay, phaseForXp, moodFor, isSick, PHASES,
} from "./state.js";
import { getActiveBaby, setActiveBaby, onActiveBaby, setViewMode } from "./session.js";
import { attachTouch } from "./touch.js";
import { buildStageLayers, paintBabyLayers } from "./render-utils.js";
import { initRooms, updateRooms } from "./rooms.js";
import { initWeather } from "./weather.js";
import { initNightmares, updateNightmares } from "./nightmares.js";
import { updateStreak } from "./streak.js";
import { initPushUI } from "./push.js";
import { initShop } from "./shop.js";
import { initMinigame } from "./minigame.js";
import { initBoard } from "./board.js";
import { initCircuit } from "./circuit.js";
import { initDino } from "./dino.js";
import { initPhotos, checkMilestones } from "./photos.js";
import { initHomework } from "./homework.js";
import { initFishing } from "./fishing.js";
import { init2048 } from "./game2048.js";
import { initMemory, initColorMatch } from "./arcade.js";
import { initFoodDrop } from "./fooddrop.js";
import { initMatch3 } from "./match3.js";
import { initStarPopper } from "./starpopper.js";
import { initSkyJump } from "./skyjump.js";
import { initHillDrive } from "./hilldrive.js";
import { initGoal } from "./goal.js";
import { initConnect } from "./connect.js";

/* Onde cada botão de cuidado leva (o status é cuidado no cômodo). */
const ACTION_SCREEN = {
  feed:  "screen-kitchen",
  clean: "screen-bathroom",
  sleep: "screen-bedroom",
  play:  "screen-arcade",
};

let room = null;                 // último estado da casa vindo do banco
const cards = {};                // babyId -> refs do card completo (single-view)
const tiles = {};                // babyId -> refs do mini no room-view
let viewMode = "single";         // "single" | "room"

const BAR_LABELS = {
  hunger: "Saciedade", sleep: "Sono", hygiene: "Higiene",
  fun: "Diversão", love: "Afeto",
};

/* ================= CARD COMPLETO (modo "ver um") ================== */
function createCard(babyId) {
  const tpl = document.getElementById("baby-card-tpl");
  const node = tpl.content.firstElementChild.cloneNode(true);
  const stage = node.querySelector(".baby-stage");

  const refs = {
    el: node, stage,
    layers: buildStageLayers(stage, true),
    bars: {}, moodText: node.querySelector(".mood-text"),
    nameEl: node.querySelector(".baby-name"),
    phaseEl: node.querySelector(".baby-phase"),
  };
  node.querySelectorAll(".bar").forEach((bar) => {
    refs.bars[bar.dataset.key] = {
      fill: bar.querySelector(".bar-fill"), wrap: bar, label: bar.querySelector(".bar-label"),
    };
  });

  node.querySelectorAll("[data-action]").forEach((btn) => {
    const key = btn.dataset.action;
    const ui = ASSETS.ui[key];
    const iconEl = btn.querySelector(".btn-icon");
    if (iconEl && ui) {
      const img = new Image();
      img.onload = () => { iconEl.style.backgroundImage = `url("${ui.src}")`; iconEl.style.backgroundColor = "transparent"; iconEl.textContent = ""; };
      img.onerror = () => { iconEl.textContent = ui.emoji || "?"; };
      img.src = ui.src;
      iconEl.style.backgroundColor = ui.placeholder;
    }
    btn.addEventListener("click", () => {
      btn.classList.add("pop");
      setTimeout(() => btn.classList.remove("pop"), 200);
      // Cada cuidado acontece no seu cômodo, com este bebê ativo.
      setActiveBaby(babyId);
      showScreen(ACTION_SCREEN[key] || "screen-home");
    });
  });

  refs.nameEl.addEventListener("blur", () => renameBaby(babyId, refs.nameEl.textContent));
  refs.nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); refs.nameEl.blur(); }
  });

  // Afeto pelo toque: cabeça/corpo/cócegas no palco deste bebê.
  attachTouch(stage, babyId);

  document.getElementById("single-view").appendChild(node);
  return refs;
}

function updateCard(refs, baby) {
  const phase = phaseForXp(baby.xp || 0);
  paintBabyLayers(refs.layers, baby);
  refs.stage.dataset.mood = moodFor(baby);

  for (const key of STATUS_KEYS) {
    const b = refs.bars[key]; if (!b) continue;
    const val = Math.round(baby[key] ?? 0);
    b.fill.style.width = `${val}%`;
    b.wrap.dataset.low = val < 25 ? "true" : "false";
    b.label.textContent = `${BAR_LABELS[key]} ${val}%`;
  }
  if (document.activeElement !== refs.nameEl) refs.nameEl.textContent = baby.name || "Bebê";
  const next = PHASES[PHASES.indexOf(phase) + 1];
  refs.phaseEl.textContent = next
    ? `${phase.name} · XP ${baby.xp}/${next.xpNeeded}`
    : `${phase.name} · XP ${baby.xp} (máx.)`;
  refs.moodText.textContent = baby.cold
    ? "Resfriado 🤧 — vista uma roupa e cuide bem dele"
    : isSick(baby) ? "Está doente… cuidem dele! 🤒" : "";
}

/* ================= MINI (modo "cômodo") ========================== */
function createTile(babyId) {
  const el = document.createElement("div");
  el.className = "room-baby";
  el.innerHTML = `<div class="mini-stage" data-mood="happy"></div><span class="mini-name"></span>`;
  el.addEventListener("click", () => { setActiveBaby(babyId); setView("single"); });

  const stage = el.querySelector(".mini-stage");
  const refs = {
    el,
    stage,
    layers: buildStageLayers(stage, false),   // sem cenário (o cômodo já tem)
    nameEl: el.querySelector(".mini-name"),
  };
  document.getElementById("room-view").appendChild(el);
  return refs;
}

function updateTile(refs, baby) {
  paintBabyLayers(refs.layers, baby);
  refs.stage.dataset.mood = moodFor(baby);
  if (document.activeElement !== refs.nameEl) refs.nameEl.textContent = baby.name || "Bebê";
}

/* Distribui os minis pelo cômodo (posição depende da quantidade). */
function layoutTiles() {
  const ids = Object.keys(tiles);
  const n = ids.length;
  const w = n <= 1 ? 60 : n === 2 ? 42 : n === 3 ? 30 : 26;
  ids.forEach((id, i) => {
    const el = tiles[id].el;
    el.style.width = `${w}%`;
    el.style.left = `${((i + 0.5) / n) * 100}%`;
    el.style.bottom = `${8 + (i % 2) * 10}%`;   // leve escada
  });
}

/* ================= RECONCILIAÇÃO E VISÃO ========================= */
function reconcile(babies) {
  const ids = Object.keys(babies || {});
  for (const id of Object.keys(cards)) if (!ids.includes(id)) { cards[id].el.remove(); delete cards[id]; }
  for (const id of Object.keys(tiles)) if (!ids.includes(id)) { tiles[id].el.remove(); delete tiles[id]; }
  for (const id of ids) {
    if (!cards[id]) cards[id] = createCard(id);
    if (!tiles[id]) tiles[id] = createTile(id);
  }
  layoutTiles();

  // garante um bebê ativo válido
  if (!getActiveBaby() || !babies[getActiveBaby()]) setActiveBaby(ids[0] || null);
  syncSelect(babies);
  applyActiveVisibility();
}

function syncSelect(babies) {
  const select = document.getElementById("home-baby-select");
  const ids = Object.keys(babies || {});
  const sig = ids.map((id) => `${id}:${babies[id].name || ""}`).join("|");
  if (select.dataset.sig !== sig) {
    select.dataset.sig = sig;
    select.innerHTML = "";
    for (const id of ids) {
      const opt = document.createElement("option");
      opt.value = id; opt.textContent = babies[id].name || "Bebê";
      select.appendChild(opt);
    }
  }
  if (getActiveBaby()) select.value = getActiveBaby();
}

/* No modo "ver um", só o card do bebê ativo aparece. */
function applyActiveVisibility() {
  const active = getActiveBaby();
  for (const [id, c] of Object.entries(cards)) {
    c.el.style.display = id === active ? "block" : "none";
  }
}

function setView(mode) {
  viewMode = mode;
  setViewMode(mode);
  const single = document.getElementById("single-view");
  const roomv = document.getElementById("room-view");
  const select = document.getElementById("home-baby-select");
  const toggle = document.getElementById("view-toggle");

  if (mode === "room") {
    single.hidden = true; roomv.hidden = false; select.style.display = "none";
    toggle.textContent = "👤"; toggle.title = "Ver um por vez";
    paintRoomBg();
  } else {
    single.hidden = false; roomv.hidden = true; select.style.display = "";
    toggle.textContent = "👥"; toggle.title = "Ver todos no cômodo";
    applyActiveVisibility();
  }
}

function paintRoomBg() {
  const roomv = document.getElementById("room-view");
  const bg = ASSETS.backgrounds.nursery;
  roomv.style.backgroundColor = bg.placeholder || "#FDEFF4";
  const img = new Image();
  img.onload = () => { roomv.style.backgroundImage = `url("${bg.src}")`; };
  img.src = bg.src;
}

/* ================= LOOP VISUAL ================================== */
function tick() {
  if (room && room.babies) {
    const now = Date.now();
    for (const [id, baby] of Object.entries(room.babies)) {
      const decayed = applyDecay(baby, now);
      if (viewMode === "single" && cards[id] && id === getActiveBaby()) updateCard(cards[id], decayed);
      if (viewMode === "room" && tiles[id]) updateTile(tiles[id], decayed);
    }
    updateRooms(room);        // atualiza o cômodo aberto (cozinha/banheiro/quarto)
    updateNightmares(room);   // banner de pesadelo
  }
  requestAnimationFrame(tick);
}

/* ================= NAVEGAÇÃO / UI ============================== */
export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "screen-arcade") { updateArcadeLabel(); updateArcadeLocks(); }
}

/* Gate de idade: tranca minigames abaixo da fase mínima do bebê ativo. */
function updateArcadeLocks() {
  if (!room) return;
  const baby = (room.babies || {})[getActiveBaby()];
  const phaseIdx = baby ? PHASES.indexOf(phaseForXp(baby.xp || 0)) : 0;
  document.querySelectorAll(".hub-card[data-min-phase]").forEach((card) => {
    const need = PHASES.findIndex((p) => p.id === card.dataset.minPhase);
    const locked = phaseIdx < need;
    card.classList.toggle("locked", locked);
    card.disabled = locked;
    let hint = card.querySelector(".lock-hint");
    if (locked) {
      if (!hint) { hint = document.createElement("span"); hint.className = "lock-hint"; card.appendChild(hint); }
      hint.textContent = `🔒 a partir de "${PHASES[need].name}"`;
    } else if (hint) { hint.remove(); }
  });
}

function updateArcadeLabel() {
  const lbl = document.getElementById("arcade-active");
  if (!lbl || !room) return;
  const b = (room.babies || {})[getActiveBaby()];
  lbl.textContent = b ? `com ${b.name || "Bebê"}` : "";
}

function wireNav() {
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => showScreen(btn.dataset.goto));
  });

  document.getElementById("home-baby-select")
    .addEventListener("change", (e) => setActiveBaby(e.target.value));

  document.getElementById("view-toggle")
    .addEventListener("click", () => setView(viewMode === "single" ? "room" : "single"));

  const adopt = document.getElementById("adopt-btn");
  adopt.textContent = `➕ Adotar bebê (${GAME_CONFIG.adoptCost} 🪙)`;
  adopt.addEventListener("click", () => {
    const name = prompt("Nome do novo bebê?", "Bebê");
    if (name === null) return;
    addBaby(name.trim() || "Bebê");
  });

  // Quando o bebê ativo muda em qualquer lugar, reflete aqui.
  onActiveBaby(() => {
    const sel = document.getElementById("home-baby-select");
    if (getActiveBaby()) sel.value = getActiveBaby();
    applyActiveVisibility();
    updateArcadeLabel();
    updateArcadeLocks();
  });
}

/* ================= BOOTSTRAP ================================== */
/* ---------------------------------------------------------------------
 * BANNER LATERAL (só em tela larga, tipo PC): mostra a criança ativa
 * inteirinha, com tudo o que está vestindo.
 * Fica no escopo do módulo (não dentro de main) para não haver risco de
 * ser chamado antes de existir, e é blindado: se der problema aqui, o
 * resto da atualização de estado continua funcionando.
 * ------------------------------------------------------------------- */
let bannerRefs = null;
function atualizarBanner(state) {
  try {
    const alvo = document.getElementById("banner-stage");
    if (!alvo) return;
    const box = document.getElementById("banner-bebe");
    const baby = state && state.babies && state.babies[getActiveBaby()];
    if (!baby) { if (box) box.style.display = "none"; return; }
    if (box) box.style.display = "";
    if (!bannerRefs) bannerRefs = buildStageLayers(alvo, false);
    paintBabyLayers(bannerRefs, baby);
    alvo.dataset.mood = moodFor(baby);
    const nome = document.getElementById("banner-nome");
    const fase = document.getElementById("banner-fase");
    if (nome) nome.textContent = baby.name || "Bebê";
    if (fase) fase.textContent = phaseForXp(baby.xp || 0).name;
  } catch (e) {
    console.error("[Ninhada] banner lateral:", e);
  }
}

async function main() {
  document.getElementById("room-title").textContent = ROOM_NAME;

  try {
    await initSync();
  } catch (err) {
    document.body.insertAdjacentHTML("afterbegin",
      `<p style="padding:16px;color:#E38C7A">Erro ao conectar no Firebase. Confira js/config.js.</p>`);
    console.error(err);
    return;
  }

  onStateChange((state) => {
    room = state;
    window.__STATE__ = state;
    const coins = state.coins ?? 0;
    document.getElementById("coins").textContent = coins;
    const ck = document.getElementById("coins-kitchen");
    if (ck) ck.textContent = coins;
    reconcile(state.babies);
    updateStreak(state);
    atualizarBanner(state);
    checkMilestones(state);
    updateArcadeLocks();
    const adopt = document.getElementById("adopt-btn");
    if (adopt) adopt.disabled = coins < (GAME_CONFIG.adoptCost || 0);
  });

  wireNav();
  setView("single");
  initRooms();
  initWeather(() => (room ? room.babies : null));
  initNightmares({
    getBabies: () => (room ? room.babies : null),
    goToBedroom: (babyId) => { setActiveBaby(babyId); showScreen("screen-bedroom"); },
  });
  /* Cada módulo é iniciado dentro de um try/catch: se UM minigame tiver
   * problema, ele é o único que deixa de funcionar — a casa, as crianças
   * e os outros jogos continuam de pé. (Sem isso, um erro em qualquer
   * arquivo derrubava o app inteiro: tela vazia e botões sem resposta.) */
  const seguro = (nome, fn) => {
    try { fn(); }
    catch (e) {
      console.error(`[Ninhada] falha ao iniciar "${nome}":`, e);
      falhas.push(nome);
    }
  };
  const falhas = [];

  seguro("notificações", initPushUI);
  seguro("loja", initShop);
  seguro("flappy", initMinigame);
  seguro("recados", initBoard);
  seguro("feira de ciências", initCircuit);
  seguro("dino", initDino);
  seguro("álbum", initPhotos);
  seguro("dever de casa", initHomework);
  seguro("pescaria", initFishing);
  seguro("2048", init2048);
  seguro("memória", initMemory);
  seguro("color match", initColorMatch);
  seguro("food drop", initFoodDrop);
  seguro("match 3", initMatch3);
  seguro("star popper", initStarPopper);
  seguro("sky jump", initSkyJump);
  seguro("hill drive", initHillDrive);
  seguro("goal", initGoal);
  seguro("connect", initConnect);

  if (falhas.length) {
    const aviso = document.createElement("div");
    aviso.className = "aviso-falha";
    aviso.textContent = `⚠️ Não deu para iniciar: ${falhas.join(", ")}. O resto do jogo funciona normalmente.`;
    document.body.appendChild(aviso);
    setTimeout(() => aviso.remove(), 9000);
  }

  tick();

  setInterval(() => { if (room) syncDecay(); }, 60_000);
}

document.addEventListener("DOMContentLoaded", main);
