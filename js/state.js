/* =====================================================================
 * state.js  —  LÓGICA PURA DE ESTADO (sem Firebase, sem DOM)
 * ---------------------------------------------------------------------
 * O truque central do jogo está aqui: o status NÃO cai só enquanto o
 * app está aberto. Ele cai com base no TEMPO REAL decorrido desde a
 * última atualização (campo `lastUpdate`). Assim:
 *   - Fecha o app 3h, volta: o bebê está com fome de 3h. ✔
 *   - Os dois celulares mostram o mesmo valor, porque calculam a partir
 *     do mesmo `lastUpdate` que está no banco. ✔
 * ===================================================================== */

import { GAME_CONFIG, TIER_MULTIPLIER, BALANCE } from "./config.js";

export const STATUS_KEYS = ["hunger", "sleep", "hygiene", "fun", "love"];
/* Saúde é um status à parte: não decai com o tempo — ela SOBE ou DESCE
 * em função de como a criança está sendo cuidada (ver ajustarSaude). */
export const SAUDE_KEY = "health";

/* Fases de vida em ordem. O bebê sobe de fase ao atingir o xpNeeded. */
export const PHASES = BALANCE.growth.phases;

export function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

/* Estado inicial de UM bebê (só o que é individual). */
export function defaultBaby(name = "Bebê") {
  return {
    name,
    hunger: 80, sleep: 80, hygiene: 80, fun: 80, love: 80,
    health: 100,          // saúde: 0–100 (abaixo de doenteAbaixo, adoece)
    doces: 0,             // doces comidos hoje (zera na virada do dia)
    cafes: 0,             // cafés tomados hoje
    remedioDia: null,     // dia em que tomou remédio (1 por dia)
    diaDoce: null,        // dia a que se referem os contadores acima
    xp: 0,
    equipped: {},
    room: "quarto",        // em qual cômodo a criança está
    lastUpdate: Date.now(),
  };
}

/* -------------------------------------------------------------------
 * SAÚDE
 * Não decai sozinha com o relógio: é recalculada a partir dos outros
 * status. Cuidado bom empurra para cima, descuido puxa para baixo.
 *   sobem  : higiene e saciedade altas, média boa, temperatura amena
 *   descem : sujeira, fome, média ruim, frio, excesso de doce/gordura
 * ----------------------------------------------------------------- */
export function ajustarSaude(state, horas, opcoes = {}) {
  const H = BALANCE.health;
  if (!H || horas <= 0) return state.health ?? 100;
  const s = state;
  const media = STATUS_KEYS.reduce((t, k) => t + (s[k] ?? 0), 0) / STATUS_KEYS.length;

  let delta = 0;
  // higiene e saciedade pesam mais que o resto
  delta += ((s.hygiene ?? 0) - 50) / 50 * H.pesoHigiene;
  delta += ((s.hunger  ?? 0) - 50) / 50 * H.pesoSaciedade;
  delta += (media - 50) / 50 * H.pesoMedia;

  // frio castiga; temperatura amena ajuda
  if (opcoes.frio) delta -= H.penalidadeFrio;
  else if (opcoes.tempoBom) delta += H.bonusTempoBom;

  // excesso de doce/gordura do dia
  const excesso = Math.max(0, (s.doces ?? 0) - H.docesSemPenalidade);
  if (excesso > 0) delta -= excesso * H.penalidadePorDoce;

  return clamp((s.health ?? 100) + delta * horas);
}

/* A criança fica DOENTE abaixo deste limite (e só sara acima do outro). */
export function estaDoente(state) {
  const H = BALANCE.health || {};
  const doente = !!state.doente;
  const h = state.health ?? 100;
  if (doente) return h < (H.saraAcima ?? 55);      // histerese: sara mais alto
  return h < (H.doenteAbaixo ?? 35);
}

/* Estado inicial da CASA (compartilhado entre os bebês e os dois jogadores).
 *   - coins/inventory são da casa (guarda-roupa e carteira comuns).
 *   - babies é um mapa de bebês; começamos com um. */
export function defaultRoom() {
  return {
    coins: GAME_CONFIG.startingCoins,
    inventory: {},                 // { "hat_bear": true, ... }  guarda-roupa comum
    babies: {
      baby_1: defaultBaby("Bebê"),
    },
  };
}

/* Descobre a fase atual a partir do XP. */
export function phaseForXp(xp) {
  let current = PHASES[0];
  for (const p of PHASES) if (xp >= p.xpNeeded) current = p;
  return current;
}

/* Aplica o decaimento por tempo até `now`, devolvendo um novo estado.
 * Não muda XP/coins — só os status e o lastUpdate. */
export function applyDecay(state, now = Date.now()) {
  const s = { ...state };
  const hours = Math.max(0, (now - (s.lastUpdate || now)) / 3_600_000);
  for (const key of STATUS_KEYS) {
    const rate = GAME_CONFIG.decayPerHour[key] || 0;
    s[key] = clamp((s[key] ?? 0) - rate * hours);
  }
  s.lastUpdate = now;
  return s;
}

/* Média dos status — usada para saber se o bebê está feliz/doente. */
export function averageStatus(state) {
  const total = STATUS_KEYS.reduce((sum, k) => sum + (state[k] ?? 0), 0);
  return total / STATUS_KEYS.length;
}

export function isSick(state) {
  return averageStatus(state) < GAME_CONFIG.sickThreshold;
}

/* Decide o próximo estado de resfriado a partir do clima e do cuidado.
 *   - Pega resfriado: tempo ruim (frio/chuva) + SEM roupa + mal cuidado.
 *   - Recupera: agasalhado (roupa) + bem cuidado.
 * (sem poções — só agasalho e carinho) */
export function nextColdState(baby, weather) {
  // "vestido" = tem camisa OU calça. (Antes olhava `equipped.clothes`, slot
  // que deixou de existir no refactor do boneco de papel — por isso a
  // criança ficava presa no resfriado para sempre.)
  const eq = baby.equipped || {};
  const dressed = !!(eq.camisa || eq.calca);
  const avg = averageStatus(baby);
  if (baby.cold) return !(dressed && avg >= 55);            // ainda resfriado?
  return !!weather && (weather.cold || weather.rain) && !dressed && avg < 45;
}

/* Humor do bebê a partir da média — controla o "mood" mostrado na tela. */
export function moodFor(state) {
  if (state.nightmare) return "nightmare";
  if (state.cold) return "cold";
  const avg = averageStatus(state);
  if (isSick(state)) return "sick";
  if (avg < 40) return "crying";
  if (avg < 70) return "neutral";
  return "happy";
}

/* É madrugada agora? (janela configurável, pode cruzar a meia-noite) */
export function isNightNow(d = new Date()) {
  const h = d.getHours();
  const start = GAME_CONFIG.nightStartHour ?? 22;
  const end = GAME_CONFIG.nightEndHour ?? 6;
  return start <= end ? (h >= start && h < end) : (h >= start || h < end);
}

/* Decide se um bebê deve ter um pesadelo agora (dado o sorteio). */
export function wantsNightmare(baby, night, roll) {
  if (!night || baby.nightmare) return false;
  /* Só tem pesadelo quem está DORMINDO no QUARTO: nada de pesadelo em
   * pé na cozinha. `dormindoDesde` é o carimbo da luz apagada. */
  if (!baby.dormindoDesde) return false;
  if ((baby.room || "quarto") !== "quarto") return false;
  const base = GAME_CONFIG.nightmareChance ?? 0.4;
  const p = (baby.sleep ?? 100) < 40 ? base + 0.25 : base;   // sono baixo = mais pesadelo
  return roll < p;
}

/* =====================================================================
 * FADIGA — impede farmar a mesma atividade na mesma criança
 * ---------------------------------------------------------------------
 * Devolve o FATOR de recompensa (1 = cheio, 0.5 = reduzido, 0 = nada)
 * e o novo registro de fadiga já com esta interação contada.
 * O contador zera sozinho após `fatigueResetMinutes` sem repetir.
 * IMPORTANTE: só mexe na RECOMPENSA. O status sempre sobe normalmente.
 * ===================================================================== */
export function nextFatigue(baby, activity, now = Date.now(), floor = 0) {
  const all = (baby && baby.fatigue) || {};
  const rec = all[activity] || { n: 0, at: 0 };
  const windowMs = (GAME_CONFIG.fatigueResetMinutes || 10) * 60_000;
  const n = now - (rec.at || 0) > windowMs ? 0 : rec.n || 0;   // esfriou? zera

  let factor;
  if (n < (GAME_CONFIG.fatigueFull ?? 10)) factor = 1;
  else if (n < (GAME_CONFIG.fatigueTaper ?? 15)) factor = 0.5;
  else factor = floor;

  return { factor, fatigue: { ...all, [activity]: { n: n + 1, at: now } } };
}

/* Multiplicador de recompensa pela faixa etária exigida pelo minigame:
 * jogo liberado só para criança grande paga mais que um de recém-nascido. */
export function tierMultiplier(minPhaseId) {
  const i = PHASES.findIndex((p) => p.id === minPhaseId);
  return TIER_MULTIPLIER[Math.max(0, i)] ?? 1;
}
