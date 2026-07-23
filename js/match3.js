/* =====================================================================
 * match3.js — MATCH 3 (estilo Candy Crush)
 * ---------------------------------------------------------------------
 * Troque duas peças vizinhas para formar linhas de 3 ou mais.
 * NOVO: algumas peças nascem com uma 🪙 grudada — estourar a peça
 * coleta a moeda, que paga 1:1 no fim (fora do balanceamento).
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { BALANCE } from "./config.js";
import { onScreenShown, onScreenLeft } from "./fs-canvas.js";

const N = 7;
const PECAS = ["🍓", "🫐", "🍋", "🍏", "🍇", "🍬"];
const JOGADAS = 20;
const CHANCE_MOEDA = (BALANCE.match3 && BALANCE.match3.chanceMoeda) || 0.07;
const rnd = (n) => Math.floor(Math.random() * n);

/* Peça = { e: emoji, coin: bool }. As funções puras comparam pelo emoji. */
const novaPeca = (comMoeda = true) => ({
  e: PECAS[rnd(PECAS.length)],
  coin: comMoeda && Math.random() < CHANCE_MOEDA,
});

/* ---- núcleo puro (testável) ---- */
export function acharCombos(g) {
  const marcar = new Set();
  for (let r = 0; r < N; r++) {
    let ini = 0;
    for (let c = 1; c <= N; c++) {
      if (c < N && g[r][c] && g[r][ini] && g[r][c].e === g[r][ini].e) continue;
      if (c - ini >= 3 && g[r][ini]) for (let k = ini; k < c; k++) marcar.add(r + "," + k);
      ini = c;
    }
  }
  for (let c = 0; c < N; c++) {
    let ini = 0;
    for (let r = 1; r <= N; r++) {
      if (r < N && g[r][c] && g[ini][c] && g[r][c].e === g[ini][c].e) continue;
      if (r - ini >= 3 && g[ini][c]) for (let k = ini; k < r; k++) marcar.add(k + "," + c);
      ini = r;
    }
  }
  return marcar;
}

/* Remove os marcados, derruba as colunas e cria peças novas (que podem
 * vir com 🪙). Devolve quantas moedas foram coletadas nessa leva. */
export function resolver(g, marcar, comMoeda = true) {
  let coletadas = 0;
  for (const p of marcar) {
    const [r, c] = p.split(",").map(Number);
    if (g[r][c] && g[r][c].coin) coletadas++;
    g[r][c] = null;
  }
  for (let c = 0; c < N; c++) {
    const col = [];
    for (let r = N - 1; r >= 0; r--) if (g[r][c]) col.push(g[r][c]);
    for (let r = N - 1; r >= 0; r--) g[r][c] = col[N - 1 - r] ?? novaPeca(comMoeda);
  }
  return coletadas;
}

export function novoTabuleiro() {
  let g;
  do {
    // nasce SEM moedas (senão o embaralhamento inicial já pagaria);
    // as moedas entram nas peças NOVAS que caem durante a partida
    g = Array.from({ length: N }, () => Array.from({ length: N }, () => novaPeca(false)));
    let guard = 0;
    while (acharCombos(g).size && guard++ < 60) resolver(g, acharCombos(g), false);
  } while (acharCombos(g).size);
  return g;
}

export function trocaValida(g, a, b) {
  const t = g.map((r) => [...r]);
  const tmp = t[a.r][a.c]; t[a.r][a.c] = t[b.r][b.c]; t[b.r][b.c] = tmp;
  return acharCombos(t).size > 0;
}

/* ---------------- jogo ---------------- */
export function initMatch3() {
  const grid = document.getElementById("m3-grid");
  if (!grid) return;

  let g, pontos, moedas, jogadas, sel, travado, rodando;
  const elHud = document.getElementById("m3-hud");
  const elMsg = document.getElementById("m3-msg");
  const btn = document.getElementById("m3-new");
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  function hud() {
    elHud.textContent = pontos + " pts · 🪙 " + moedas + " · " + jogadas + " jogadas · 🏆 " + getRecord("match3");
  }

  function comecar() {
    g = novoTabuleiro();
    pontos = 0; moedas = 0; jogadas = JOGADAS; sel = null; travado = false; rodando = true;
    elMsg.textContent = ""; btn.hidden = true;
    desenhar(); hud();
  }

  function desenhar(sumindo) {
    sumindo = sumindo || new Set();
    grid.style.gridTemplateColumns = "repeat(" + N + ", 1fr)";
    grid.innerHTML = "";
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const b = document.createElement("button");
      b.className = "m3-cel"
        + (sel && sel.r === r && sel.c === c ? " sel" : "")
        + (sumindo.has(r + "," + c) ? " pop" : "");
      b.textContent = g[r][c].e;
      if (g[r][c].coin) {
        const badge = document.createElement("span");
        badge.className = "m3-coin";
        badge.textContent = "🪙";
        b.appendChild(badge);
      }
      b.onclick = () => tocar(r, c);
      grid.appendChild(b);
    }
  }

  const vizinho = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

  async function tocar(r, c) {
    if (!rodando || travado) return;
    if (!sel) { sel = { r: r, c: c }; desenhar(); return; }
    if (sel.r === r && sel.c === c) { sel = null; desenhar(); return; }

    const alvo = { r: r, c: c };
    if (!vizinho(sel, alvo)) { sel = alvo; desenhar(); return; }

    if (!trocaValida(g, sel, alvo)) {
      const antes = sel; sel = null; desenhar();
      const i = antes.r * N + antes.c;
      if (grid.children[i]) {
        grid.children[i].classList.add("shake");
        setTimeout(() => grid.children[i] && grid.children[i].classList.remove("shake"), 320);
      }
      return;
    }

    const tmp = g[sel.r][sel.c]; g[sel.r][sel.c] = g[alvo.r][alvo.c]; g[alvo.r][alvo.c] = tmp;
    sel = null; jogadas--; travado = true;
    desenhar(); hud();
    await cascatas();
    travado = false;
    if (rodando && jogadas <= 0) fim();
  }

  async function cascatas() {
    let nivel = 0;
    for (;;) {
      const combos = acharCombos(g);
      if (!combos.size) break;
      nivel++;
      pontos += combos.size * 10 * nivel;
      desenhar(combos);
      if (nivel > 1) elMsg.textContent = "Cascata x" + nivel + "! 🎉";
      hud();
      await espera(260);
      moedas += resolver(g, combos);
      desenhar(); hud();
      await espera(160);
    }
    if (nivel <= 1) elMsg.textContent = "";
  }

  async function fim() {
    rodando = false; btn.hidden = false;
    const pts = Math.floor(pontos / 100);
    if (pts > 0 || moedas > 0) {
      const r = await rewardGame(getActiveBaby(), "match3", pts, pontos, moedas);
      registerCare();
      elMsg.textContent = r.factor === 0 && moedas === 0
        ? pontos + " pts — a criança se cansou."
        : (r.record ? "🏆 NOVO RECORDE! " : "") + pontos + " pts · 🪙" + moedas + " · +" + r.coins + " 🪙  +" + r.xp + " XP" + (r.factor < 1 ? " (cansado)" : "");
    } else elMsg.textContent = "Fim! " + pontos + " pts";
  }

  btn.onclick = comecar;

  /* sair da tela = zerar; entrar = partida nova */
  onScreenShown("screen-match3", comecar);
  onScreenLeft("screen-match3", () => { rodando = false; travado = true; });
  comecar();
}
