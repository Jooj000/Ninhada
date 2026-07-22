/* =====================================================================
 * session.js — ESTADO DE SESSÃO (não sincronizado)
 * ---------------------------------------------------------------------
 * Guarda quem é o "bebê ativo" (o selecionado no momento). É local de
 * cada aparelho — cada jogador pode estar olhando um bebê diferente.
 * A Sala, a Loja e os minigames leem/escrevem daqui, então você
 * seleciona uma vez e vale para todos.
 * ===================================================================== */

let activeBabyId = null;
const listeners = [];

export function getActiveBaby() { return activeBabyId; }

export function setActiveBaby(id) {
  if (id === activeBabyId) return;
  activeBabyId = id;
  listeners.forEach((fn) => fn(id));
}

export function onActiveBaby(fn) { listeners.push(fn); }
