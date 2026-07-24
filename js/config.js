/* =====================================================================
 * config.js — CHAVES E IDENTIDADE (Firebase, sala, notificações)
 * ---------------------------------------------------------------------
 * ⚙️  OS NÚMEROS DO JOGO (status, XP, moedas, minigames, preços...)
 *     FICAM TODOS EM  js/balance.js  — é lá que você ajusta o equilíbrio.
 * Aqui ficam só as credenciais e a identidade da sala.
 * Este arquivo re-exporta o balance nos formatos que o resto do código
 * já usa, então nada quebra.
 * ===================================================================== */

import { BALANCE } from "./balance.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA0tFr-fZmVNXeLF8x9lbfORVhUtmknRFs",
  authDomain: "ninhada-bf659.firebaseapp.com",
  databaseURL: "https://ninhada-bf659-default-rtdb.firebaseio.com/",
  projectId: "ninhada-bf659",
  storageBucket: "ninhada-bf659.firebasestorage.app",
  messagingSenderId: "167652549564",
  appId: "1:167652549564:web:a5c8abdbf30e40fdc501b9",
  measurementId: "G-PLN1CCL24S",
};

/* "Quarto" único no banco onde os dois jogadores se encontram. */
export const ROOM_ID = "nosso-bebe";

/* Nome do cômodo mostrado no topo da tela principal. */
export const ROOM_NAME = "Sala";

/* Chave PÚBLICA do Web Push (a privada fica em server/.env). */
export const PUSH = {
  vapidPublicKey: "BLAN8a4kiID_i1h31M0sLu_5bnmYeRpapOY2icrqJ8kyAkNAVSdCVda8wXmTAILpIua9F7bvZnYzkgD22FzdQNk",
};

/* ---------------------------------------------------------------------
 * Daqui pra baixo é só "tradução" do balance.js para os formatos que os
 * módulos consomem. Não precisa editar nada aqui.
 * ------------------------------------------------------------------- */
export { BALANCE };

export const GAME_CONFIG = {
  decayPerHour:        BALANCE.status.decayPerHour,
  sickThreshold:       BALANCE.status.sickThreshold,
  conditionThreshold:  BALANCE.status.conditionThreshold,

  actionGain:          BALANCE.care.actionGain,
  funPerMinigame:      BALANCE.care.funPerMinigame,
  xpPerCare:           BALANCE.care.xpPerCare,
  xpPerAction:         BALANCE.care.xpPerAction,
  remedioCusto:        BALANCE.care.remedioCusto,
  remedioLove:         BALANCE.care.remedioLove,
  remedioXp:           BALANCE.care.remedioXp,

  startingCoins:       BALANCE.economy.startingCoins,
  adoptCost:           BALANCE.economy.adoptCost,
  recordBonus:         BALANCE.economy.recordBonus,

  fatigueFull:         BALANCE.fatigue.full,
  fatigueTaper:        BALANCE.fatigue.taper,
  fatigueResetMinutes: BALANCE.fatigue.resetMinutes,
  hardFloor:           BALANCE.fatigue.hardFloor,

  hwTimeStart:         BALANCE.homework.timeStart,
  hwTimeMin:           BALANCE.homework.timeMin,

  coldThreshold:       BALANCE.weather.coldThreshold,
  coldCheckMinutes:    BALANCE.weather.coldCheckMinutes,

  nightStartHour:        BALANCE.nightmares.startHour,
  nightEndHour:          BALANCE.nightmares.endHour,
  nightmareCheckMinutes: BALANCE.nightmares.checkMinutes,
  nightmareChance:       BALANCE.nightmares.chance,
  nightmareReward:       BALANCE.nightmares.reward,
};

export const MINIGAMES = BALANCE.minigames;
export const STARPOPPER = BALANCE.starpopper;
export const SKYJUMP = BALANCE.skyjump;
export const HILLDRIVE = BALANCE.hilldrive;
export const TIER_MULTIPLIER = BALANCE.tierMultiplier;
export const NOTIFY = BALANCE.notify;
export const WEATHER = {
  changeMinutes: BALANCE.weather.changeMinutes,
  stormChance:   BALANCE.weather.stormChance,
  rainChance:    BALANCE.weather.rainChance,
  coldChance:    BALANCE.weather.coldChance,
};
