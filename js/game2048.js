/* =====================================================================
 * game2048.js — 2048
 * ---------------------------------------------------------------------
 * Deslize (ou setas) para juntar peças iguais. Pontos = placar / 50.
 * Recorde compartilhado entre os dois jogadores.
 * ===================================================================== */

import { rewardGame, saveRecord, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

const N = 4;
const CORES = {
  2: ["#F1ECF7", "#4A3F55"], 4: ["#E6DCF0", "#4A3F55"], 8: ["#F7C7D8", "#4A3F55"],
  16: ["#F5A9C4", "#fff"], 32: ["#E888AE", "#fff"], 64: ["#B57BA6", "#fff"],
  128: ["#9A5F8C", "#fff"], 256: ["#7FB5C9", "#fff"], 512: ["#5C9BC4", "#fff"],
  1024: ["#7EC8A0", "#fff"], 2048: ["#FFD36B", "#4A3F55"],
};

export function init2048() {
  const grid = document.getElementById("g2048-grid");
  if (!grid) return;

  let board, score, over, won;
  const elScore = document.getElementById("g2048-score");
  const elMsg = document.getElementById("g2048-msg");
  const btn = document.getElementById("g2048-new");

  const vazio = () => Array.from({ length: N }, () => Array(N).fill(0));

  function novaPeca() {
    const livres = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!board[r][c]) livres.push([r, c]);
    if (!livres.length) return;
    const [r, c] = livres[Math.floor(Math.random() * livres.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  function reiniciar() {
    board = vazio(); score = 0; over = false; won = false;
    novaPeca(); novaPeca();
    elMsg.textContent = "";
    desenhar();
  }

  /* Move e junta uma linha para a ESQUERDA. Devolve [nova, ganho, mudou] */
  function comprime(linha) {
    const v = linha.filter((x) => x);
    let ganho = 0;
    for (let i = 0; i < v.length - 1; i++) {
      if (v[i] === v[i + 1]) { v[i] *= 2; ganho += v[i]; v.splice(i + 1, 1); }
    }
    while (v.length < N) v.push(0);
    return [v, ganho, v.join() !== linha.join()];
  }

  const girar = (b) => b[0].map((_, i) => b.map((row) => row[i]).reverse());   // 90° horário

  function mover(dir) {
    if (over) return;
    let b = board.map((r) => [...r]);
    const voltas = { left: 0, down: 1, right: 2, up: 3 }[dir];
    for (let i = 0; i < voltas; i++) b = girar(b);

    let mudou = false, ganho = 0;
    b = b.map((linha) => {
      const [nova, g, m] = comprime(linha);
      ganho += g; if (m) mudou = true;
      return nova;
    });
    for (let i = 0; i < (4 - voltas) % 4; i++) b = girar(b);

    if (!mudou) return;
    board = b; score += ganho;
    novaPeca();
    if (!won && board.some((r) => r.includes(2048))) { won = true; elMsg.textContent = "🎉 Chegou a 2048!"; }
    if (semMovimentos()) fim();
    desenhar();
  }

  function semMovimentos() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!board[r][c]) return false;
      if (c < N - 1 && board[r][c] === board[r][c + 1]) return false;
      if (r < N - 1 && board[r][c] === board[r + 1][c]) return false;
    }
    return true;
  }

  async function fim() {
    over = true;
    const pontos = Math.floor(score / 50);
    const rec = getRecord("g2048");
    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "g2048", pontos);
      await saveRecord("g2048", score);
      registerCare();
      elMsg.textContent = r.factor === 0
        ? `Fim! ${score} pts — a criança se cansou.`
        : `${score > rec ? "🏆 NOVO RECORDE! " : "Fim! "}+${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
    } else elMsg.textContent = "Fim de jogo!";
  }

  function desenhar() {
    grid.innerHTML = "";
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = board[r][c];
      const cel = document.createElement("div");
      cel.className = "g2048-cel";
      if (v) {
        const [bg, fg] = CORES[v] || ["#4A3F55", "#fff"];
        cel.style.background = bg; cel.style.color = fg;
        cel.textContent = v;
        cel.style.fontSize = v >= 1024 ? "1.05rem" : v >= 128 ? "1.25rem" : "1.5rem";
      }
      grid.appendChild(cel);
    }
    elScore.textContent = `${score} · 🏆 ${getRecord("g2048")}`;
  }

  /* controles: teclado + deslizar */
  window.addEventListener("keydown", (e) => {
    if (!document.getElementById("screen-2048").classList.contains("active")) return;
    const m = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
    if (m) { e.preventDefault(); mover(m); }
  });

  let sx = 0, sy = 0;
  grid.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
  grid.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    mover(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  grid.style.touchAction = "none";

  btn.onclick = reiniciar;
  reiniciar();
}
