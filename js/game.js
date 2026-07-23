/* =====================================================================
 * game.js — CORE: A CASA COMO CENA ÚNICA + NAVEGAÇÃO POR CÔMODOS
 * ---------------------------------------------------------------------
 * Nada de "caixinhas de site": o fundo do cômodo preenche a tela, a
 * criança fica em foco e os status viram chips pequenos no topo (toque
 * para ver os valores em %). As setinhas embaixo trocam de cômodo:
 *
 *   Quarto ........ dormir (luz) e guarda-roupa
 *   Sala de Estar . microfone (em breve), recados, álbum e a porta da loja
 *   Sala de Jogos . brinquedo abre a bandeja de jogos
 *   Cozinha ....... faca abre o menu de cozinhar
 *   Banheiro ...... sabonete ensaboa; chuveirinho enxágua as bolhas
 *
 * Sair da tela de um minigame RESETA o minigame (evento "screen-left").
 * ===================================================================== */

import {
  initSync, onStateChange, syncDecay, addBaby, renameBaby,
  boostStatus, sootheNightmare,
} from "./firebase-sync.js";
import { ASSETS } from "./assets-map.js";
import { GAME_CONFIG, ROOM_NAME, BALANCE } from "./config.js";
import {
  STATUS_KEYS, applyDecay, phaseForXp, moodFor, isSick, PHASES,
} from "./state.js";
import { getActiveBaby, setActiveBaby, onActiveBaby, setViewMode } from "./session.js";
import { attachTouch } from "./touch.js";
import { buildStageLayers, paintBabyLayers } from "./render-utils.js";
import { initRooms, updateRooms } from "./rooms.js";
import { initWeather } from "./weather.js";
import { initNightmares, updateNightmares } from "./nightmares.js";
import { updateStreak, registerCare } from "./streak.js";
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
import { announceScreenChange } from "./fs-canvas.js";

let room = null;                 // último estado da casa vindo do banco
const cards = {};                // babyId -> refs (visão solo)
const tiles = {};                // babyId -> refs (visão em grupo)
let viewMode = "single";         // "single" | "room"

/* ================= CÔMODOS DA CASA ================================ */
const ROOMS = [
  {
    id: "quarto", name: "Quarto",
    grad: "linear-gradient(180deg,#4A4370 0%,#7C6BA4 46%,#B9A6D6 100%)",
    hotspots: () => [
      { emoji: lightsOff ? "☀️" : "🌙", label: lightsOff ? "Acender" : "Dormir", act: toggleLights },
      { emoji: "👚", label: "Guarda-roupa", act: () => openShop("guarda") },
      ...(babyHasNightmare() ? [{ emoji: "🤍", label: "Acalmar", cls: "hot-pulse", act: soothe }] : []),
    ],
  },
  {
    id: "sala", name: "Sala de Estar",
    grad: "linear-gradient(180deg,#8C5A50 0%,#C98F6E 42%,#EFD9B8 100%)",
    hotspots: () => [
      { emoji: "🎤", label: "Em breve", disabled: true, act: () => flashMsg("O microfone chega em breve! 🎤") },
      { emoji: "📝", label: "Recados", act: () => showScreen("screen-board") },
      { emoji: "📔", label: "Álbum", act: () => showScreen("screen-album") },
      { emoji: "🚪", label: "Lojinha", act: () => openShop("loja") },
    ],
  },
  {
    id: "jogos", name: "Sala de Jogos",
    grad: "linear-gradient(180deg,#2E6E77 0%,#54A6A0 45%,#BCE3D2 100%)",
    hotspots: () => [
      { emoji: "🧸", label: "Brincar", act: openTray },
    ],
  },
  {
    id: "cozinha", name: "Cozinha",
    grad: "linear-gradient(180deg,#9A6A2E 0%,#D8A452 45%,#F5E2B8 100%)",
    hotspots: () => [
      { emoji: "🔪", label: "Cozinhar", act: () => showScreen("screen-kitchen") },
    ],
  },
  {
    id: "banheiro", name: "Banheiro",
    grad: "linear-gradient(180deg,#2F6E8E 0%,#5BA6C4 45%,#CBEAF2 100%)",
    hotspots: () => [
      { emoji: "🧼", label: "Ensaboar", cls: tool === "soap" ? "hot-on" : "", act: () => setTool("soap") },
      { emoji: "🚿", label: "Enxaguar", cls: tool === "shower" ? "hot-on" : "", act: () => setTool("shower") },
      ...(babyHasCold() ? [{ emoji: "💊", label: `Remédio ${GAME_CONFIG.remedioCusto}🪙`, cls: "hot-pulse", act: giveMed }] : []),
    ],
  },
];
let roomIdx = Math.max(0, ROOMS.findIndex((r) => r.id === (localStorage.getItem("ninhada-room") || "quarto")));

const currentRoom = () => ROOMS[roomIdx];

function setRoom(idxOrId) {
  const idx = typeof idxOrId === "number"
    ? (idxOrId + ROOMS.length) % ROOMS.length
    : Math.max(0, ROOMS.findIndex((r) => r.id === idxOrId));
  // sair do cômodo: acende a luz, larga a ferramenta e limpa as bolhas
  if (ROOMS[roomIdx].id !== ROOMS[idx].id) { setLights(false); setTool(null); clearBubbles(); }
  roomIdx = idx;
  localStorage.setItem("ninhada-room", ROOMS[idx].id);

  const scene = document.getElementById("screen-home");
  scene.dataset.room = ROOMS[idx].id;
  document.getElementById("room-name").textContent = ROOMS[idx].name;

  const bg = document.getElementById("scene-bg");
  bg.style.backgroundImage = ROOMS[idx].grad;
  // se existir arte do cômodo, ela cobre o gradiente
  const img = new Image();
  const src = `assets/backgrounds/${ROOMS[idx].id}.png`;
  img.onload = () => {
    if (currentRoom().id === ROOMS[idx].id) {
      bg.style.backgroundImage = `url("${src}"), ${ROOMS[idx].grad}`;
    }
  };
  img.src = src;

  renderHotspots();
}
export function goToRoom(id) { showScreen("screen-home"); setRoom(id); }

function renderHotspots() {
  const box = document.getElementById("hotspots");
  box.innerHTML = "";
  for (const h of currentRoom().hotspots()) {
    const b = document.createElement("button");
    b.className = "hotspot " + (h.cls || "");
    b.disabled = !!h.disabled && false;   // desabilitado ainda responde com a mensagem
    b.innerHTML = `<span class="hot-emoji">${h.emoji}</span><span class="hot-label">${h.label}</span>`;
    b.addEventListener("click", h.act);
    box.appendChild(b);
  }
}

function flashMsg(text, ms = 2600) {
  const el = document.getElementById("scene-msg");
  el.textContent = text;
  clearTimeout(flashMsg._t);
  flashMsg._t = setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, ms);
}

/* ---------------- QUARTO: luz / sono / pesadelo ---------------- */
let lightsOff = false;
let sleepTimer = null;

function setLights(off) {
  lightsOff = off;
  document.getElementById("lights-overlay").hidden = !off;
  document.getElementById("screen-home").classList.toggle("lights-off", off);
  clearInterval(sleepTimer);
  if (off) {
    sleepTimer = setInterval(() => {
      const home = document.getElementById("screen-home");
      if (home.classList.contains("active") && currentRoom().id === "quarto" && lightsOff) {
        boostStatus(getActiveBaby(), "sleep", BALANCE.care.sleepPerTick);
        registerCare();
      }
    }, 1500);
  }
  renderHotspots();
}
function toggleLights() {
  setLights(!lightsOff);
  flashMsg(lightsOff ? "Shhh… hora de dormir 😴" : "Bom dia! ☀️");
}
function babyHasNightmare() {
  const b = room && room.babies && room.babies[getActiveBaby()];
  return !!(b && b.nightmare);
}
async function soothe() {
  setLights(false);
  const r = await sootheNightmare(getActiveBaby());
  flashMsg(r && r.ok === false ? "Alguém já acudiu 💛" : "Pesadelo espantado! 🤍");
  registerCare();
}

/* ---------------- BANHEIRO: sabonete + chuveirinho -------------- */
let tool = null;                // null | "soap" | "shower"
let bubbles = [];               // {x, y, el} em coordenadas do palco
let hygieneAcc = 0;

function setTool(t) {
  tool = tool === t ? null : t;
  const layer = document.getElementById("bubbles-layer");
  layer.style.pointerEvents = tool ? "auto" : "none";
  layer.style.cursor = tool ? "crosshair" : "";
  document.getElementById("shower-head").hidden = tool !== "shower";
  renderHotspots();
  if (tool === "soap") flashMsg("Esfregue a criança com o sabonete 🫧");
  if (tool === "shower") flashMsg("Passe o chuveirinho por cima das bolhas 🚿");
}

function clearBubbles() {
  bubbles.forEach((b) => b.el.remove());
  bubbles = [];
}

function stagePoint(e) {
  const r = document.getElementById("bubbles-layer").getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
}

let lastSoap = { x: -99, y: -99 };
function soapAt(p) {
  if (bubbles.length >= 42) return;
  if (Math.hypot(p.x - lastSoap.x, p.y - lastSoap.y) < 22) return;   // espaça as bolhas
  lastSoap = { x: p.x, y: p.y };
  const el = document.createElement("span");
  el.className = "foam";
  el.textContent = "🫧";
  el.style.left = p.x + "px";
  el.style.top = p.y + "px";
  document.getElementById("bubbles-layer").appendChild(el);
  bubbles.push({ x: p.x, y: p.y, el });
}

function showerAt(p) {
  const head = document.getElementById("shower-head");
  head.style.left = p.x + "px";
  head.style.top = Math.min(p.y, p.h * 0.45) + "px";

  let rinsed = 0;
  bubbles = bubbles.filter((b) => {
    // o chuveirinho só limpa o que está EMBAIXO dele
    if (Math.abs(b.x - p.x) < 40 && b.y > p.y - 8) {
      dropWater(p.x, Math.min(p.y, p.h * 0.45), b.x, b.y);
      b.el.classList.add("foam-pop");
      setTimeout(() => b.el.remove(), 260);
      rinsed++;
      return false;
    }
    return true;
  });
  if (rinsed) {
    hygieneAcc += rinsed * 2;
    // agrupa os envios para não metralhar o banco
    clearTimeout(showerAt._t);
    showerAt._t = setTimeout(() => {
      const ganho = Math.round(hygieneAcc); hygieneAcc = 0;
      if (ganho > 0) { boostStatus(getActiveBaby(), "hygiene", ganho); registerCare(); }
    }, 500);
    if (!bubbles.length) flashMsg("Limpinho! ✨");
  }
}

function dropWater(fromX, fromY, toX, toY) {
  const layer = document.getElementById("bubbles-layer");
  const d = document.createElement("span");
  d.className = "water-drop";
  d.textContent = "💧";
  d.style.left = fromX + "px";
  d.style.top = fromY + "px";
  d.style.setProperty("--dx", (toX - fromX) + "px");
  d.style.setProperty("--dy", (toY - fromY) + "px");
  layer.appendChild(d);
  setTimeout(() => d.remove(), 420);
}

function wireBathroom() {
  const layer = document.getElementById("bubbles-layer");
  let down = false;
  const use = (e) => {
    if (currentRoom().id !== "banheiro" || !tool) return;
    const p = stagePoint(e);
    if (tool === "soap") soapAt(p);
    else showerAt(p);
  };
  layer.addEventListener("pointerdown", (e) => { down = true; use(e); });
  layer.addEventListener("pointermove", (e) => {
    if (currentRoom().id === "banheiro" && tool === "shower") use(e);   // o chuveirinho segue o dedo/mouse
    else if (down) use(e);
  });
  window.addEventListener("pointerup", () => { down = false; });
}

/* ---------------- BANHEIRO: remédio ----------------------------- */
function babyHasCold() {
  const b = room && room.babies && room.babies[getActiveBaby()];
  return !!(b && b.cold);
}
async function giveMed() {
  const { giveMedicine } = await import("./firebase-sync.js");
  const r = await giveMedicine(getActiveBaby());
  flashMsg(r.ok ? "Tomou o remédio e melhorou! 💊" : "Moedas insuficientes 😢");
  registerCare();
  renderHotspots();
}

/* ================= CHIPS DE STATUS (topo) ======================= */
const CHIP_DEFS = [
  { key: "hunger",  emoji: "🍗", label: "Saciedade" },
  { key: "sleep",   emoji: "😴", label: "Sono" },
  { key: "hygiene", emoji: "🧼", label: "Higiene" },
  { key: "fun",     emoji: "🎈", label: "Diversão" },
  { key: "love",    emoji: "💛", label: "Afeto" },
  { key: "xp",      emoji: "⭐", label: "XP" },
];
let showPct = false;
const chipRefs = {};

function buildChips() {
  const box = document.getElementById("status-chips");
  box.innerHTML = "";
  for (const c of CHIP_DEFS) {
    const el = document.createElement("button");
    el.className = "chip";
    el.title = c.label;
    el.innerHTML = `<span class="chip-emoji">${c.emoji}</span><span class="chip-val"></span>`;
    el.addEventListener("click", () => {
      showPct = !showPct;
      box.classList.toggle("show-pct", showPct);
    });
    box.appendChild(el);
    chipRefs[c.key] = { el, val: el.querySelector(".chip-val") };
  }
}

function updateChips(baby) {
  if (!baby) return;
  const phase = phaseForXp(baby.xp || 0);
  const next = PHASES[PHASES.indexOf(phase) + 1];
  for (const c of CHIP_DEFS) {
    const r = chipRefs[c.key];
    if (!r) continue;
    let pct;
    if (c.key === "xp") {
      pct = next
        ? Math.round(((baby.xp - phase.xpNeeded) / (next.xpNeeded - phase.xpNeeded)) * 100)
        : 100;
      r.el.title = next ? `${phase.name} · XP ${baby.xp}/${next.xpNeeded}` : `${phase.name} (máx.)`;
    } else {
      pct = Math.round(baby[c.key] ?? 0);
    }
    pct = Math.max(0, Math.min(100, pct));
    r.val.textContent = pct + "%";
    r.el.dataset.low = c.key !== "xp" && pct < 25 ? "true" : "false";
    r.el.style.setProperty("--fill", pct + "%");
  }
}

/* ================= CRIANÇA NA CENA (visão solo) ================== */
function createCard(babyId) {
  const node = document.createElement("div");
  node.className = "scene-baby";
  node.innerHTML = `
    <div class="baby-stage scene-baby-stage" data-mood="happy"></div>
    <div class="scene-baby-name">
      <span class="baby-name" contenteditable="true" spellcheck="false"></span>
      <small class="baby-phase"></small>
    </div>`;
  const stage = node.querySelector(".baby-stage");
  const refs = {
    el: node, stage,
    layers: buildStageLayers(stage, false),      // sem cenário: o cômodo é o fundo
    nameEl: node.querySelector(".baby-name"),
    phaseEl: node.querySelector(".baby-phase"),
  };
  refs.nameEl.addEventListener("blur", () => renameBaby(babyId, refs.nameEl.textContent));
  refs.nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); refs.nameEl.blur(); }
  });
  attachTouch(stage, babyId);                    // carinho: cabeça/corpo/cócegas
  document.getElementById("single-view").appendChild(node);
  return refs;
}

function updateCard(refs, baby) {
  paintBabyLayers(refs.layers, baby);
  refs.stage.dataset.mood = moodFor(baby);
  if (document.activeElement !== refs.nameEl) refs.nameEl.textContent = baby.name || "Bebê";
  refs.phaseEl.textContent = phaseForXp(baby.xp || 0).name;
  const aviso = baby.cold ? "Resfriado 🤧 — vista uma roupa e cuide bem"
    : isSick(baby) ? "Está doente… cuidem dele! 🤒" : "";
  if (aviso) flashMsg(aviso, 4000);
}

/* ================= GRUPO (todos no cômodo) ====================== */
function createTile(babyId) {
  const el = document.createElement("div");
  el.className = "room-baby";
  el.innerHTML = `<div class="mini-stage" data-mood="happy"></div><span class="mini-name"></span>`;
  el.addEventListener("click", () => { setActiveBaby(babyId); setView("single"); });
  const stage = el.querySelector(".mini-stage");
  const refs = {
    el, stage,
    layers: buildStageLayers(stage, false),
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

function layoutTiles() {
  const ids = Object.keys(tiles);
  const n = ids.length;
  // ~1,6x maior também no modo grupo (com teto para não se sobreporem)
  const w = n <= 1 ? 92 : n === 2 ? 62 : n === 3 ? 46 : 40;
  ids.forEach((id, i) => {
    const el = tiles[id].el;
    el.style.width = `${w}%`;
    el.style.left = `${((i + 0.5) / n) * 100}%`;
    el.style.bottom = `${4 + (i % 2) * 10}%`;
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

function applyActiveVisibility() {
  const active = getActiveBaby();
  for (const [id, c] of Object.entries(cards)) {
    c.el.style.display = id === active ? "flex" : "none";
  }
}

function setView(mode) {
  viewMode = mode;
  setViewMode(mode);
  const single = document.getElementById("single-view");
  const roomv = document.getElementById("room-view");
  const select = document.getElementById("home-baby-select");
  const toggle = document.getElementById("view-toggle");
  const adopt = document.getElementById("adopt-btn");

  if (mode === "room") {
    single.hidden = true; roomv.hidden = false; select.style.display = "none";
    toggle.textContent = "👤"; toggle.title = "Ver um por vez";
    adopt.hidden = false;                       // adotar só aparece em grupo
  } else {
    single.hidden = false; roomv.hidden = true; select.style.display = "";
    toggle.textContent = "👥"; toggle.title = "Ver todos no cômodo";
    adopt.hidden = true;
    applyActiveVisibility();
  }
}

/* ================= LOOP VISUAL ==================================
 * BLINDADO: um erro em qualquer parte do desenho NÃO pode matar o
 * requestAnimationFrame. Antes, uma única exceção aqui congelava a tela
 * inteira (status parados, criança sem atualizar) e o motivo real ficava
 * escondido no console. Agora o erro é avisado uma vez e o loop segue. */
let erroAvisado = false;
function tick() {
  try {
    desenharQuadro();
  } catch (e) {
    if (!erroAvisado) { erroAvisado = true; console.error("[Ninhada] erro no loop visual:", e); }
  }
  requestAnimationFrame(tick);
}

function desenharQuadro() {
  if (room && room.babies) {
    const now = Date.now();
    const activeId = getActiveBaby();
    for (const [id, baby] of Object.entries(room.babies)) {
      const decayed = applyDecay(baby, now);
      if (id === activeId) updateChips(decayed);
      try {
        if (viewMode === "single" && cards[id] && id === activeId) updateCard(cards[id], decayed);
        if (viewMode === "room" && tiles[id]) updateTile(tiles[id], decayed);
      } catch (e) {
        if (!erroAvisado) { erroAvisado = true; console.error("[Ninhada] erro ao desenhar a criança:", e); }
      }
    }
    updateRooms(room);        // menu de cozinhar (quando aberto)
    updateNightmares(room);   // banner de pesadelo
  }
}

/* ================= NAVEGAÇÃO / UI ============================== */
let currentScreen = "screen-home";
let cameFromTray = false;

export function showScreen(id) {
  const prev = currentScreen;
  if (prev === id) return;
  currentScreen = id;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (prev === "screen-home") setLights(false);      // saiu do quarto: luz acesa

  // sair da tela de um jogo = RESETAR o jogo (fs-canvas.js distribui)
  announceScreenChange(prev, id);

  // voltar de um jogo para casa reabre a bandeja (você estava na sala de jogos)
  if (id === "screen-home" && cameFromTray) { openTray(); }
  if (id !== "screen-home") closeTray(false);
}

/* -------- bandeja de jogos (sala de jogos) -------- */
function openTray() {
  document.getElementById("games-tray").hidden = false;
  updateTrayLocks();
}
function closeTray(clearFlag = true) {
  document.getElementById("games-tray").hidden = true;
  if (clearFlag) cameFromTray = false;
}

function updateTrayLocks() {
  if (!room) return;
  const baby = (room.babies || {})[getActiveBaby()];
  const phaseIdx = baby ? PHASES.indexOf(phaseForXp(baby.xp || 0)) : 0;
  document.querySelectorAll(".tray-item[data-min-phase]").forEach((card) => {
    const need = PHASES.findIndex((p) => p.id === card.dataset.minPhase);
    const locked = phaseIdx < need;
    card.classList.toggle("locked", locked);
    card.disabled = locked;
    let hint = card.querySelector(".lock-hint");
    if (locked) {
      if (!hint) { hint = document.createElement("span"); hint.className = "lock-hint"; card.appendChild(hint); }
      hint.textContent = `🔒 "${PHASES[need].name}"`;
    } else if (hint) { hint.remove(); }
  });
}

/* -------- loja com modo pré-selecionado -------- */
function openShop(mode) {
  showScreen("screen-shop");
  const btn = document.getElementById(mode === "guarda" ? "mode-guarda" : "mode-loja");
  if (btn) btn.click();
}

function wireNav() {
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("tray-item")) { cameFromTray = true; closeTray(false); }
      showScreen(btn.dataset.goto);
    });
  });

  document.getElementById("tray-close").addEventListener("click", () => closeTray(true));

  document.getElementById("room-prev").addEventListener("click", () => setRoom(roomIdx - 1));
  document.getElementById("room-next").addEventListener("click", () => setRoom(roomIdx + 1));

  document.getElementById("home-baby-select")
    .addEventListener("change", (e) => setActiveBaby(e.target.value));

  document.getElementById("view-toggle")
    .addEventListener("click", () => setView(viewMode === "single" ? "room" : "single"));

  const adopt = document.getElementById("adopt-btn");
  adopt.title = `Adotar bebê (${GAME_CONFIG.adoptCost} 🪙)`;
  adopt.addEventListener("click", () => {
    const name = prompt(`Nome do novo bebê? (${GAME_CONFIG.adoptCost} 🪙)`, "Bebê");
    if (name === null) return;
    addBaby(name.trim() || "Bebê");
  });

  onActiveBaby(() => {
    const sel = document.getElementById("home-baby-select");
    if (getActiveBaby()) sel.value = getActiveBaby();
    applyActiveVisibility();
    updateTrayLocks();
    renderHotspots();
  });
}

/* ================= BANNER LATERAL (PC) ========================== */
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

/* ================= BOOTSTRAP ================================== */
/* O manifest pedia "portrait", o que TRAVA a rotação em app instalado.
 * Trocamos para "any", mas um PWA já instalado guarda o manifest antigo —
 * então destravamos também em tempo de execução. */
function liberarRotacao() {
  try {
    const so = window.screen && window.screen.orientation;
    if (so && typeof so.unlock === "function") so.unlock();
  } catch (_) { /* navegador sem suporte: segue o jogo */ }
}

async function main() {
  liberarRotacao();
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
    for (const id of ["coins-kitchen", "coins-shop"]) {
      const el = document.getElementById(id);
      if (el) el.textContent = coins;
    }
    reconcile(state.babies);
    updateStreak(state);
    atualizarBanner(state);
    checkMilestones(state);
    updateTrayLocks();
    renderHotspots();
    const adopt = document.getElementById("adopt-btn");
    if (adopt) adopt.disabled = coins < (GAME_CONFIG.adoptCost || 0);
  });

  buildChips();
  wireNav();
  wireBathroom();
  setView("single");
  setRoom(roomIdx);
  initRooms();
  initWeather(() => (room ? room.babies : null));
  initNightmares({
    getBabies: () => (room ? room.babies : null),
    goToBedroom: (babyId) => { setActiveBaby(babyId); goToRoom("quarto"); },
  });

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
