/* =====================================================================
 * firebase-sync.js  —  CAMADA DE SINCRONIZAÇÃO EM TEMPO REAL
 * ---------------------------------------------------------------------
 * Usa o Firebase Realtime Database (plano gratuito "Spark").
 * Toda escrita usa TRANSAÇÃO (runTransaction): como vocês dois podem
 * tocar no botão ao mesmo tempo em celulares diferentes, a transação
 * garante que nenhuma ação seja perdida por sobrescrita.
 *
 * OBS sobre a versão do SDK: se o console do Firebase te mostrar uma
 * versão diferente na hora de configurar, troque o número "11.6.0"
 * abaixo pelo número que ele indicar. A API modular é a mesma.
 * ===================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getDatabase, ref, onValue, runTransaction, get, set,
  push, query, limitToLast, remove
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

import { firebaseConfig, ROOM_ID, GAME_CONFIG } from "./config.js";
import { defaultRoom, defaultBaby, applyDecay, clamp, phaseForXp, nextColdState, isNightNow, wantsNightmare } from "./state.js";

let db = null;
let roomRef = null;

/* Refs auxiliares para os sub-nós. */
function babiesRef() { return ref(db, `rooms/${ROOM_ID}/babies`); }
function babyRef(id) { return ref(db, `rooms/${ROOM_ID}/babies/${id}`); }
function coinsRef()  { return ref(db, `rooms/${ROOM_ID}/coins`); }

/* Inicializa o Firebase e garante que o "quarto" exista no banco. */
export async function initSync() {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  roomRef = ref(db, `rooms/${ROOM_ID}`);

  // Cria o estado inicial só se ainda não existir.
  const snap = await get(roomRef);
  if (!snap.exists()) {
    await set(roomRef, defaultRoom());
  }
  return roomRef;
}

/* Assina mudanças em tempo real. `callback(state)` roda toda vez que
 * QUALQUER um dos dois altera algo. */
export function onStateChange(callback) {
  onValue(roomRef, (snap) => {
    const state = snap.val();
    if (state) callback(state);
  });
}

/* ------------------------------------------------------------------
 * AÇÃO DE CUIDADO (feed / sleep / clean / play / love) — por bebê
 * ---------------------------------------------------------------- */
const ACTION_TO_STATUS = {
  feed: "hunger", sleep: "sleep", clean: "hygiene", play: "fun", love: "love",
};

export function doAction(babyId, actionKey) {
  const statusKey = ACTION_TO_STATUS[actionKey];
  const gain = GAME_CONFIG.actionGain[actionKey] || 0;

  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;                    // bebê ainda carregando
    const now = Date.now();
    const decayed = applyDecay(baby, now);     // 1) atualiza pelo tempo
    decayed[statusKey] = clamp((decayed[statusKey] ?? 0) + gain); // 2) ganho
    decayed.xp = (decayed.xp ?? 0) + GAME_CONFIG.xpPerAction;      // 3) XP
    return decayed;
  });
}

/* Sincroniza o decaimento de TODOS os bebês (rodado periodicamente). */
export function syncDecay() {
  return runTransaction(babiesRef(), (babies) => {
    if (!babies) return babies;
    const now = Date.now();
    for (const id of Object.keys(babies)) {
      babies[id] = applyDecay(babies[id], now);
    }
    return babies;
  });
}

/* Genérica: aplica decaimento e soma `amount` num status do bebê. */
export function boostStatus(babyId, key, amount) {
  if (!babyId || amount <= 0) return Promise.resolve();
  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;
    const s = applyDecay(baby, Date.now());
    s[key] = clamp((s[key] ?? 0) + amount);
    return s;
  });
}

/* Aumenta o afeto de um bebê (usado pelo sistema de toque/carinho). */
export function addLove(babyId, amount) { return boostStatus(babyId, "love", amount); }

/* Aumenta a diversão de um bebê (usado pelos minigames). */
export function addFun(babyId, amount) { return boostStatus(babyId, "fun", amount); }

/* ------------------------------------------------------------------
 * COZINHA: servir comida. Debita moedas (custo), sacia a fome, pode
 * dar XP (pratos cozinhados) e registrar a receita descoberta.
 * Transação no nó raiz porque mexe em coins + baby + recipes juntos.
 * ---------------------------------------------------------------- */
export function serveFood(babyId, { hunger = 0, xp = 0, cost = 0, recipeId = null }) {
  return runTransaction(roomRef, (room) => {
    if (!room) return room;
    if ((room.coins ?? 0) < cost) return;                 // sem saldo -> aborta
    const baby = room.babies && room.babies[babyId];
    if (!baby) return;
    room.coins -= cost;
    const s = applyDecay(baby, Date.now());
    s.hunger = clamp((s.hunger ?? 0) + hunger);
    s.xp = (s.xp ?? 0) + xp;
    room.babies[babyId] = s;
    if (recipeId) { room.recipes = room.recipes || {}; room.recipes[recipeId] = true; }
    return room;
  });
}

/* Reavalia o resfriado de um bebê conforme o clima. A trava por
 * `lastColdCheck` garante que, mesmo os dois celulares chamando, só
 * o primeiro dentro do intervalo aplica (idempotente). */
export function weatherCheck(babyId, weather) {
  const intervalMs = (GAME_CONFIG.coldCheckMinutes || 15) * 60_000;
  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;
    const now = Date.now();
    if (now - (baby.lastColdCheck || 0) < intervalMs) return baby;   // ainda não é hora
    const s = applyDecay(baby, now);
    s.cold = nextColdState(s, weather);
    s.lastColdCheck = now;
    return s;
  });
}

/* Reavalia se um bebê tem um pesadelo (só à noite). Travado por
 * `lastNightmareCheck` para os dois celulares não dispararem juntos. */
export function nightmareCheck(babyId) {
  const interval = (GAME_CONFIG.nightmareCheckMinutes || 20) * 60_000;
  const night = isNightNow();
  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;
    const now = Date.now();
    if (now - (baby.lastNightmareCheck || 0) < interval) return baby;
    baby.lastNightmareCheck = now;
    const s = applyDecay(baby, now);
    if (wantsNightmare(s, night, Math.random())) {
      s.nightmare = { since: now };
      s.sleep = clamp((s.sleep ?? 0) - 15);   // acorda assustado
      s.fun = clamp((s.fun ?? 0) - 10);
    }
    return s;
  });
}

/* Acalma o pesadelo (acender a luz + carinho). Transação na raiz para
 * dar a recompensa em moedas de forma atômica: só QUEM CHEGA PRIMEIRO
 * ganha; o segundo vê que já foi resolvido. Resolve com true se você
 * foi quem acalmou. */
export function sootheNightmare(babyId) {
  let claimed = false;
  return runTransaction(roomRef, (room) => {
    if (!room) return room;
    const baby = room.babies && room.babies[babyId];
    if (!baby || !baby.nightmare) { claimed = false; return room; }
    claimed = true;
    const s = applyDecay(baby, Date.now());
    s.nightmare = null;
    s.love = clamp((s.love ?? 0) + (GAME_CONFIG.nightmareReward?.love ?? 30));
    room.babies[babyId] = s;
    room.coins = (room.coins ?? 0) + (GAME_CONFIG.nightmareReward?.coins ?? 20);
    return room;
  }).then(() => claimed);
}

/* ------------------------------------------------------------------
 * FOGUINHO (streak): dias seguidos em que vocês cuidaram das crianças.
 * Guardado no nível da casa: rooms/{room}/streak
 * ---------------------------------------------------------------- */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Marca que houve cuidado hoje. Se ontem também houve, o foguinho cresce;
 * se pulou um dia, recomeça em 1. Transação = os dois celulares somam certo. */
export function touchStreak() {
  return runTransaction(ref(db, `rooms/${ROOM_ID}/streak`), (s) => {
    const today = dayKey();
    const y = dayKey(new Date(Date.now() - 86_400_000));
    s = s || { count: 0, lastDay: null, best: 0 };
    if (s.lastDay === today) return s;                 // já contou hoje
    s.count = s.lastDay === y ? (s.count || 0) + 1 : 1;
    s.lastDay = today;
    s.best = Math.max(s.best || 0, s.count);
    return s;
  });
}

/* Cura um bebê específico. */
export function healBaby(babyId) {
  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;
    const s = applyDecay(baby, Date.now());
    for (const k of ["hunger", "sleep", "hygiene", "fun", "love"]) s[k] = clamp(s[k] + 25);
    return s;
  });
}

/* ------------------------------------------------------------------
 * ECONOMIA (nível da casa)
 * ---------------------------------------------------------------- */
export function addCoins(amount) {
  return runTransaction(coinsRef(), (coins) => {
    return Math.max(0, (coins ?? 0) + amount);
  });
}

/* Compra um item: valida saldo, debita moedas e guarda no inventário
 * comum (guarda-roupa da casa). Transação no nó raiz do quarto porque
 * mexe em coins + inventory ao mesmo tempo. */
export function buyItem(item) {
  return runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (!room.inventory) room.inventory = {};
    if (room.inventory[item.id]) return room;             // já possui
    if ((room.coins ?? 0) < item.price) return;            // saldo insuficiente -> aborta
    room.coins -= item.price;
    room.inventory[item.id] = true;
    return room;
  });
}

/* Veste/troca item num bebê específico (camada única). `id = null` remove. */
export function equipItem(babyId, slotId, id) {
  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;
    if (!baby.equipped) baby.equipped = {};
    baby.equipped[slotId] = id;
    return baby;
  });
}

/* Liga/desliga um acessório numa ZONA (accTras/accFrente). Sem limite:
 * a zona guarda um conjunto de ids. */
export function toggleAccessory(babyId, zoneId, itemId) {
  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;
    if (!baby.equipped) baby.equipped = {};
    const set = baby.equipped[zoneId] || {};
    if (set[itemId]) delete set[itemId]; else set[itemId] = true;
    baby.equipped[zoneId] = Object.keys(set).length ? set : null;   // null limpa a zona
    return baby;
  });
}

/* Adota/desbloqueia um novo bebê, cobrando adoptCost da casa. */
export function addBaby(name = "Bebê") {
  return runTransaction(roomRef, (room) => {
    if (!room) return room;
    const cost = GAME_CONFIG.adoptCost || 0;
    if ((room.coins ?? 0) < cost) return;                  // saldo insuficiente -> aborta
    if (!room.babies) room.babies = {};
    room.coins -= cost;
    const id = "b" + Date.now();                           // id único
    room.babies[id] = defaultBaby(name);
    return room;
  });
}

/* Renomeia um bebê. */
export function renameBaby(babyId, name) {
  const clean = String(name).trim().slice(0, 24) || "Bebê";
  return runTransaction(babyRef(babyId), (baby) => {
    if (!baby) return baby;
    baby.name = clean;
    return baby;
  });
}

/* ------------------------------------------------------------------
 * QUADRO DE AVISOS (recados compartilhados entre os dois)
 * Fica num nó separado: rooms/{room}/board
 * ---------------------------------------------------------------- */
function boardRef() {
  return ref(db, `rooms/${ROOM_ID}/board`);
}

export function postMessage(text, author = "eu", authorId = null) {
  const clean = String(text).trim().slice(0, 280);
  if (!clean) return Promise.resolve();
  return push(boardRef(), { text: clean, author, authorId, at: Date.now() });
}

export function onBoardChange(callback, max = 50) {
  const q = query(boardRef(), limitToLast(max));
  onValue(q, (snap) => {
    const val = snap.val() || {};
    // Vira lista ordenada por horário.
    const list = Object.entries(val)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => a.at - b.at);
    callback(list);
  });
}

/* ------------------------------------------------------------------
 * ASSINATURAS DE PUSH (para o notificador saber onde entregar)
 * rooms/{room}/pushSubs/{playerId}
 * ---------------------------------------------------------------- */
export function savePushSubscription(playerId, data) {
  return set(ref(db, `rooms/${ROOM_ID}/pushSubs/${playerId}`), data);
}

export function removePushSubscription(playerId) {
  return remove(ref(db, `rooms/${ROOM_ID}/pushSubs/${playerId}`));
}

/* Apaga um recado específico pelo id. */
export function deleteMessage(id) {
  return remove(ref(db, `rooms/${ROOM_ID}/board/${id}`));
}

/* Apaga o quadro inteiro. */
export function clearBoard() {
  return remove(boardRef());
}

export { phaseForXp };
