/* =====================================================================
 * identity.js — QUEM ESTÁ JOGANDO NESTE APARELHO
 * ---------------------------------------------------------------------
 * Guardado só no aparelho (localStorage). Serve para:
 *   - assinar os recados no Quadro de Avisos
 *   - o notificador saber a quem avisar (não avisa quem escreveu)
 * ===================================================================== */

const ID_KEY = "bebe_player_id";
const NAME_KEY = "bebe_player_name";

export function getPlayerId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getPlayerName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function setPlayerName(name) {
  localStorage.setItem(NAME_KEY, String(name).trim().slice(0, 24));
}

/* Pergunta o nome uma vez (usado ao ativar notificações/postar recado). */
export function ensurePlayerName() {
  let n = getPlayerName();
  if (!n) {
    n = (prompt("Como você quer aparecer nos recados?", "Eu") || "Eu").trim().slice(0, 24);
    setPlayerName(n);
  }
  return n;
}
