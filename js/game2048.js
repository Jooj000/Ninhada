/* =====================================================================
 * game2048.js — 2048 (com animação)
 * ---------------------------------------------------------------------
 * Cada peça tem IDENTIDADE própria e é posicionada de forma absoluta, e
 * a troca de posição é animada por `transform` (CSS transition). Assim:
 *   - peça que anda .... desliza até o lugar novo
 *   - peça que junta ... a que sobra dá uma "pulsada"
 *   - peça que nasce ... aparece crescendo
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

const N = 4;
const ANIM = 130;   // ms do deslize (bate com o CSS)

const CORES = {
  2: ["#F1ECF7", "#4A3F55"], 4: ["#E6DCF0", "#4A3F55"], 8: ["#F7C7D8", "#4A3F55"],
  16: ["#F5A9C4", "#fff"], 32: ["#E888AE", "#fff"], 64: ["#B57BA6", "#fff"],
  128: ["#9A5F8C", "#fff"], 256: ["#7FB5C9", "#fff"], 512: ["#5C9BC4", "#fff"],
  1024: ["#7EC8A0", "#fff"], 2048: ["#FFD36B", "#4A3F55"],
};

export function init2048() {
  const palco = document.getElementById("g2048-grid");
  if (!palco) return;

  let pecas, score, over, won, travado, proximoId;
  const elScore = document.getElementById("g2048-score");
  const elMsg = document.getElementById("g2048-msg");
  const btn = document.getElementById("g2048-new");

  /* ---- helpers ---- */
  const ocupada = (r, c) => pecas.find((p) => p.r === r && p.c === c && !p.morre);

  function nascer() {
    const livres = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!ocupada(r, c)) livres.push([r, c]);
    if (!livres.length) return;
    const [r, c] = livres[Math.floor(Math.random() * livres.length)];
    pecas.push({ id: proximoId++, v: Math.random() < 0.9 ? 2 : 4, r, c, nova: true });
  }

  function reiniciar() {
    pecas = []; score = 0; over = false; won = false; travado = false; proximoId = 1;
    nascer(); nascer();
    elMsg.textContent = "";
    montarFundo();
    desenhar();
  }

  /* Fundo fixo com as 16 casinhas (só decorativo). */
  function montarFundo() {
    palco.innerHTML = "";
    const fundo = document.createElement("div");
    fundo.className = "g2048-bg";
    for (let i = 0; i < N * N; i++) fundo.appendChild(document.createElement("div"));
    palco.appendChild(fundo);
    const camada = document.createElement("div");
    camada.className = "g2048-tiles";
    camada.id = "g2048-tiles";
    palco.appendChild(camada);
  }

  /* ---- movimento ---- */
  function mover(dir) {
    if (over || travado) return;

    // vetores de varredura: começamos pelo lado do movimento
    const dr = dir === "up" ? -1 : dir === "down" ? 1 : 0;
    const dc = dir === "left" ? -1 : dir === "right" ? 1 : 0;

    const ordem = [...pecas].sort((a, b) => {
      if (dr) return dr > 0 ? b.r - a.r : a.r - b.r;
      return dc > 0 ? b.c - a.c : a.c - b.c;
    });

    const grade = Array.from({ length: N }, () => Array(N).fill(null));
    for (const p of pecas) grade[p.r][p.c] = p;

    let mudou = false, ganho = 0;
    for (const p of ordem) p.juntou = false;

    for (const p of ordem) {
      grade[p.r][p.c] = null;
      let r = p.r, c = p.c;
      // avança enquanto a próxima casa estiver livre
      while (true) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) break;
        const alvo = grade[nr][nc];
        if (!alvo) { r = nr; c = nc; continue; }
        // junta se for igual e nenhuma das duas já juntou nesta jogada
        if (alvo.v === p.v && !alvo.juntou && !p.juntou) {
          alvo.v *= 2; alvo.juntou = true; ganho += alvo.v;
          p.r = nr; p.c = nc; p.morre = true;    // desliza até lá e some
          mudou = true;
          break;
        }
        break;
      }
      if (!p.morre) {
        if (r !== p.r || c !== p.c) mudou = true;
        p.r = r; p.c = c;
        grade[r][c] = p;
      }
    }

    if (!mudou) return;

    score += ganho;
    travado = true;
    desenhar();                                   // anima o deslize

    setTimeout(() => {
      pecas = pecas.filter((p) => !p.morre);      // remove as que juntaram
      nascer();
      travado = false;
      if (!won && pecas.some((p) => p.v === 2048)) { won = true; elMsg.textContent = "🎉 Chegou a 2048!"; }
      desenhar();
      if (semMovimentos()) fim();
    }, ANIM);
  }

  function semMovimentos() {
    if (pecas.length < N * N) return false;
    const g = Array.from({ length: N }, () => Array(N).fill(0));
    for (const p of pecas) g[p.r][p.c] = p.v;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (c < N - 1 && g[r][c] === g[r][c + 1]) return false;
      if (r < N - 1 && g[r][c] === g[r + 1][c]) return false;
    }
    return true;
  }

  async function fim() {
    over = true;
    const pontos = Math.floor(score / 50);
    const rec = getRecord("g2048");
    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "g2048", pontos, score);
      registerCare();
      elMsg.textContent = r.factor === 0
        ? "Fim! " + score + " pts — a criança se cansou."
        : (r.record ? "🏆 NOVO RECORDE! " : "Fim! ") + "+" + r.coins + " 🪙  +" + r.xp + " XP" + (r.factor < 1 ? " (cansado)" : "");
    } else elMsg.textContent = "Fim de jogo!";
  }

  /* ---- desenho: cada peça vira um div posicionado por transform ---- */
  function desenhar() {
    const camada = document.getElementById("g2048-tiles");
    if (!camada) return;
    const vivos = new Set();

    for (const p of pecas) {
      vivos.add(String(p.id));
      let el = camada.querySelector('[data-id="' + p.id + '"]');
      if (!el) {
        el = document.createElement("div");
        el.className = "g2048-tile" + (p.nova ? " nasce" : "");
        el.dataset.id = p.id;
        camada.appendChild(el);
        p.nova = false;
      }
      const [bg, fg] = CORES[p.v] || ["#4A3F55", "#fff"];
      el.style.background = bg;
      el.style.color = fg;
      el.textContent = p.v;
      el.style.fontSize = p.v >= 1024 ? "1.05rem" : p.v >= 128 ? "1.25rem" : "1.5rem";
      // cada passo = largura da peça (100%) + o vão de 8px entre as casas
      el.style.transform =
        "translate(calc(" + p.c + " * (100% + 8px)), calc(" + p.r + " * (100% + 8px)))";
      el.style.zIndex = p.morre ? 1 : 2;
      if (p.juntou) {
        el.classList.remove("junta");
        void el.offsetWidth;                       // reinicia a animação
        el.classList.add("junta");
      }
    }
    // some com os elementos de peças que não existem mais
    camada.querySelectorAll(".g2048-tile").forEach((el) => {
      if (!vivos.has(el.dataset.id)) el.remove();
    });

    elScore.textContent = score + " · 🏆 " + getRecord("g2048");
  }

  /* ---- controles ---- */
  window.addEventListener("keydown", (e) => {
    const tela = document.getElementById("screen-2048");
    if (!tela || !tela.classList.contains("active")) return;
    const m = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
    if (m) { e.preventDefault(); mover(m); }
  });

  let sx = 0, sy = 0;
  palco.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
  palco.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    mover(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  palco.style.touchAction = "none";

  btn.onclick = reiniciar;
  reiniciar();
}
