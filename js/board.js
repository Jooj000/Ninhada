/* =====================================================================
 * board.js — QUADRO DE AVISOS (lousa da cozinha)
 * ---------------------------------------------------------------------
 * Recados de texto compartilhados em tempo real. Cada recado pode ser
 * apagado no ✕; há também "Limpar tudo".
 * ===================================================================== */

import { postMessage, onBoardChange, deleteMessage } from "./firebase-sync.js";
import { getPlayerId, ensurePlayerName } from "./identity.js";

export function initBoard() {
  const form = document.getElementById("board-form");
  const input = document.getElementById("board-input");
  const list = document.getElementById("board-list");
  if (!form || !input || !list) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    postMessage(input.value, ensurePlayerName(), getPlayerId());
    input.value = "";
  });

  onBoardChange((messages) => {
    list.innerHTML = "";
    if (!messages.length) {
      list.innerHTML = `<p class="board-empty">Nenhum recado ainda. Deixe o primeiro 💜</p>`;
      return;
    }
    for (const m of messages) {
      const el = document.createElement("div");
      el.className = "board-note";
      const time = new Date(m.at).toLocaleString("pt-BR",
        { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      el.innerHTML =
        `<button class="board-del" title="Apagar recado">✕</button>
         <span class="board-text"></span><span class="board-meta"></span>`;
      el.querySelector(".board-text").textContent = m.text;   // seguro contra HTML
      el.querySelector(".board-meta").textContent = (m.author ? m.author + " · " : "") + time;
      el.querySelector(".board-del").addEventListener("click", () => deleteMessage(m.id));
      list.appendChild(el);
    }
    list.scrollTop = 0;   // mais recentes já ficam no topo
  });
}
