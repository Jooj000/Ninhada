/* =====================================================================
 * streak.js — FOGUINHO 🔥 (dias seguidos cuidando)
 * ---------------------------------------------------------------------
 * Qualquer cuidado (comida, banho, sono, carinho, minigame) marca o dia.
 * Cuidou em dias consecutivos = foguinho cresce. Pulou um dia = zera.
 * É da CASA: conta o cuidado dos dois juntos.
 *
 * `registerCare()` tem trava local: mesmo sendo chamada centenas de
 * vezes (ex.: carinho contínuo), só grava no banco uma vez por dia.
 * ===================================================================== */

import { touchStreak, dayKey } from "./firebase-sync.js";

let lastSentDay = null;

export function registerCare() {
  const today = dayKey();
  if (lastSentDay === today) return;        // já marcou hoje neste aparelho
  lastSentDay = today;
  touchStreak();
}

/* Estado do foguinho a partir do que veio do banco. */
export function streakInfo(room) {
  const s = (room && room.streak) || { count: 0, lastDay: null, best: 0 };
  const today = dayKey();
  const y = dayKey(new Date(Date.now() - 86_400_000));
  const alive = s.lastDay === today || s.lastDay === y;   // ainda vale?
  return {
    count: alive ? (s.count || 0) : 0,
    best: s.best || 0,
    doneToday: s.lastDay === today,
    alive,
  };
}

export function updateStreak(room) {
  const pill = document.getElementById("streak-pill");
  if (!pill) return;
  const info = streakInfo(room);
  pill.hidden = false;
  pill.textContent = `🔥 ${info.count}`;
  pill.classList.toggle("cold", !info.doneToday);
  pill.title = info.doneToday
    ? `Foguinho de ${info.count} dia(s)! Recorde: ${info.best}`
    : `Cuidem hoje para manter o foguinho! Recorde: ${info.best}`;
}
