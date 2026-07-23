/* =====================================================================
 * connect.js — CONNECT (ligar os pares com canos)
 * ---------------------------------------------------------------------
 * Regra do original (fonte: Poupedia): ligue os DOIS bebês da mesma cor
 * desenhando um cano de um até o outro. Só vale quando TODOS os pares
 * estiverem ligados E nenhum espaço ficar vazio.
 * Tem um tempo correndo; terminar uma rodada devolve tempo. O placar é
 * o número de rodadas concluídas. O tabuleiro começa 5x5 e vai crescendo.
 *
 * GERAÇÃO DOS DESAFIOS (a parte difícil):
 * para garantir que SEMPRE existe solução que preenche o tabuleiro todo,
 * eu monto um caminho hamiltoniano (passa por cada casa exatamente uma
 * vez) e depois corto esse caminho em pedaços. Cada pedaço vira um par:
 * as pontas são os bebês coloridos. Assim a solução existe por
 * construção — é literalmente o caminho que eu cortei.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { onScreenShown, onScreenLeft } from "./fs-canvas.js";

const CORES = ["#E05A5A","#5B8FD6","#6BB77B","#E5B93C","#9A5FC0","#E88AC0","#4FBFC0","#C9772E"];
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const emb = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);

/* Caminho que passa por TODAS as casas exatamente uma vez (DFS com volta atrás). */
export function caminhoHamiltoniano(N, limite = 200000) {
  const total = N * N;
  const visitado = new Set();
  const caminho = [];
  let passos = 0;

  function livresDe(c) {
    let n = 0;
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (x >= 0 && x < N && y >= 0 && y < N && !visitado.has(`${x},${y}`)) n++;
    }
    return n;
  }

  function dfs(c) {
    if (++passos > limite) return false;
    visitado.add(`${c.x},${c.y}`);
    caminho.push(c);
    if (caminho.length === total) return true;

    // heurística de Warnsdorff: tenta primeiro o vizinho com menos saídas
    const viz = [];
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || x >= N || y < 0 || y >= N || visitado.has(`${x},${y}`)) continue;
      viz.push({ x, y });
    }
    for (const v of emb(viz).sort((a, b) => livresDe(a) - livresDe(b))) {
      if (dfs(v)) return true;
    }
    visitado.delete(`${c.x},${c.y}`);
    caminho.pop();
    return false;
  }

  for (const inicio of emb([...Array(total).keys()].map((i) => ({ x: i % N, y: (i / N) | 0 })))) {
    visitado.clear(); caminho.length = 0; passos = 0;
    if (dfs(inicio)) return [...caminho];
  }
  return null;
}

/* Corta o caminho em pedaços de 2+ casas. Cada pedaço = um par colorido. */
export function gerarDesafio(N, nPares) {
  const cam = caminhoHamiltoniano(N);
  if (!cam) return null;
  const total = cam.length;

  // tamanhos aleatórios (mínimo 2) que somem exatamente o total
  let tamanhos = new Array(nPares).fill(2);
  let resto = total - nPares * 2;
  while (resto > 0) { tamanhos[Math.floor(Math.random() * nPares)]++; resto--; }
  tamanhos = emb(tamanhos);

  const solucao = [], pares = [];
  let i = 0;
  for (let k = 0; k < nPares; k++) {
    const pedaco = cam.slice(i, i + tamanhos[k]);
    i += tamanhos[k];
    solucao.push(pedaco);
    pares.push({ cor: CORES[k % CORES.length], a: pedaco[0], b: pedaco[pedaco.length - 1] });
  }
  return { N, pares, solucao };
}

/* Terminou? Todos os pares ligados E nenhuma casa vazia. */
export function terminou(N, pares, canos) {
  const ocupadas = new Set();
  for (let k = 0; k < pares.length; k++) {
    const c = canos[k];
    if (!c || c.length < 2) return false;
    const p = pares[k];
    const ini = c[0], fim = c[c.length - 1];
    const ligaCerto =
      (ini.x === p.a.x && ini.y === p.a.y && fim.x === p.b.x && fim.y === p.b.y) ||
      (ini.x === p.b.x && ini.y === p.b.y && fim.x === p.a.x && fim.y === p.a.y);
    if (!ligaCerto) return false;
    for (const cel of c) ocupadas.add(`${cel.x},${cel.y}`);
  }
  return ocupadas.size === N * N;
}

/* ---------------- jogo ---------------- */
export function initConnect() {
  const cv = document.getElementById("cn-canvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const LADO = (cv.width = cv.height = 340);

  let N, pares, canos, desenhando, rodadas, tempo, timerId = null, rodando, morto;
  const elHud = document.getElementById("cn-hud");
  const elMsg = document.getElementById("cn-msg");
  const elBar = document.getElementById("cn-timer");
  const btn = document.getElementById("cn-new");

  const TEMPO_INI = 75, BONUS_RODADA = 22;
  const cel = () => LADO / N;

  function tamanhoDaVez() {
    if (rodadas < 2) return { n: 5, p: 4 };
    if (rodadas < 5) return { n: 6, p: 5 };
    if (rodadas < 9) return { n: 7, p: 6 };
    return { n: 8, p: 7 };
  }

  function novaRodada() {
    const { n, p } = tamanhoDaVez();
    let d = gerarDesafio(n, p);
    let tentativas = 0;
    while (!d && tentativas++ < 6) d = gerarDesafio(n, p);
    if (!d) { d = gerarDesafio(5, 4); }
    N = d.N; pares = d.pares;
    canos = pares.map(() => []);
    desenhando = null;
    desenhar(); hud();
  }

  function comecar() {
    rodadas = 0; tempo = TEMPO_INI; rodando = true; morto = false;
    btn.hidden = true; elMsg.textContent = "";
    novaRodada();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      tempo -= 0.1;
      elBar.style.width = `${Math.max(0, (tempo / TEMPO_INI) * 100)}%`;
      elBar.dataset.low = tempo < 15 ? "true" : "false";
      if (tempo <= 0) { clearInterval(timerId); timerId = null; fim(); }
    }, 100);
  }

  function hud() {
    elHud.textContent = `rodada ${rodadas + 1} · ${N}×${N} · 🏆 ${getRecord("connect")}`;
  }

  /* --- desenho --- */
  function desenhar() {
    ctx.fillStyle = "#2A2740"; ctx.fillRect(0, 0, LADO, LADO);
    const c = cel();

    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, LADO); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * c); ctx.lineTo(LADO, i * c); ctx.stroke();
    }

    // canos
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = c * 0.42;
    for (let k = 0; k < pares.length; k++) {
      const cam = canos[k];
      if (!cam || cam.length < 2) continue;
      ctx.strokeStyle = pares[k].cor;
      ctx.beginPath();
      cam.forEach((p, i) => {
        const x = p.x * c + c / 2, y = p.y * c + c / 2;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }

    // bebês (pontas)
    for (const p of pares) {
      for (const pt of [p.a, p.b]) {
        const x = pt.x * c + c / 2, y = pt.y * c + c / 2;
        ctx.fillStyle = p.cor;
        ctx.beginPath(); ctx.arc(x, y, c * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.beginPath(); ctx.arc(x - c * 0.09, y - c * 0.05, c * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + c * 0.09, y - c * 0.05, c * 0.05, 0, Math.PI * 2); ctx.fill();
      }
    }

    // quantas casas ainda faltam
    const usadas = new Set();
    for (const cam of canos) for (const p of (cam || [])) usadas.add(`${p.x},${p.y}`);
    const faltam = N * N - usadas.size;
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(faltam ? `${faltam} casas vazias` : "tabuleiro cheio!", LADO - 8, LADO - 8);
  }

  /* --- interação --- */
  const casaDe = (e) => {
    const r = cv.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * N);
    return (x >= 0 && x < N && y >= 0 && y < N) ? { x, y } : null;
  };
  const mesma = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const pontaDe = (p) => pares.findIndex((q) => mesma(q.a, p) || mesma(q.b, p));

  function comecarTraco(p) {
    const k = pontaDe(p);
    if (k >= 0) { desenhando = k; canos[k] = [p]; desenhar(); return; }
    // tocou no meio de um cano: continua a partir dali
    for (let i = 0; i < canos.length; i++) {
      const pos = (canos[i] || []).findIndex((c) => mesma(c, p));
      if (pos > 0) { desenhando = i; canos[i] = canos[i].slice(0, pos + 1); desenhar(); return; }
    }
  }

  function estender(p) {
    if (desenhando === null || !p) return;
    const cam = canos[desenhando];
    const ult = cam[cam.length - 1];
    if (mesma(ult, p)) return;
    if (Math.abs(ult.x - p.x) + Math.abs(ult.y - p.y) !== 1) return;   // só vizinhas

    // voltando por cima do próprio cano = apagar
    const jaTem = cam.findIndex((c) => mesma(c, p));
    if (jaTem >= 0) { canos[desenhando] = cam.slice(0, jaTem + 1); desenhar(); return; }

    // não passa por cima de outro bebê que não seja o par certo
    const k = pontaDe(p);
    if (k >= 0 && k !== desenhando) return;

    // passou por cima de outro cano: corta o outro
    for (let i = 0; i < canos.length; i++) {
      if (i === desenhando) continue;
      const pos = (canos[i] || []).findIndex((c) => mesma(c, p));
      if (pos >= 0) canos[i] = canos[i].slice(0, pos);
    }

    cam.push(p);
    desenhar();

    if (terminou(N, pares, canos)) {
      rodadas++;
      tempo = Math.min(TEMPO_INI, tempo + BONUS_RODADA);
      elMsg.textContent = `Rodada completa! +${BONUS_RODADA}s ⏱️`;
      desenhando = null;
      setTimeout(() => { if (rodando) { novaRodada(); elMsg.textContent = ""; } }, 650);
    }
  }

  async function fim() {
    rodando = false; morto = true; desenhando = null;
    btn.hidden = false;
    if (rodadas > 0) {
      const r = await rewardGame(getActiveBaby(), "connect", rodadas);
      registerCare();
      elMsg.textContent = r.factor === 0
        ? `Tempo esgotado! ${rodadas} rodada(s) — a criança se cansou.`
        : `${r.record ? "🏆 NOVO RECORDE! " : "Tempo esgotado! "}${rodadas} rodada(s) · +${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
    } else elMsg.textContent = "Tempo esgotado! Nenhuma rodada completa.";
  }

  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", (e) => { if (rodando) comecarTraco(casaDe(e)); });
  cv.addEventListener("pointermove", (e) => {
    if (!rodando || desenhando === null) return;
    if (!(e.buttons || e.pressure > 0)) return;
    estender(casaDe(e));
  });
  cv.addEventListener("pointerup", () => { desenhando = null; });
  btn.onclick = comecar;

  /* sair = matar o relógio e voltar ao estado pré-início */
  function zerar() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    rodando = false; morto = false; rodadas = 0;
    btn.hidden = false;
    elMsg.textContent = "";
    elBar.style.width = "0%";
    novaRodada();
    hud();
  }
  onScreenShown("screen-connect", zerar);
  onScreenLeft("screen-connect", zerar);

  rodadas = 0; rodando = false;
  novaRodada();
  elHud.textContent = "Ligue os pares e preencha TODAS as casas";
}
