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

/* Modo de visão da Sala: "single" (um bebê) ou "room" (todos no cômodo).
 * O álbum usa isso para decidir entre foto individual e foto de grupo. */
let viewMode = "single";
export function getViewMode() { return viewMode; }
export function setViewMode(m) { viewMode = m; }
