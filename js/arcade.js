/* =====================================================================
 * arcade.js — MEMÓRIA + COLOR MATCH
 * ---------------------------------------------------------------------
 * MEMÓRIA: vire as cartas e ache os pares. Menos jogadas = mais pontos.
 * COLOR MATCH: a palavra diz uma cor, mas está pintada de outra. Toque
 *   no botão da COR DA TINTA (não da palavra) antes do tempo acabar.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { onScreenShown, onScreenLeft } from "./fs-canvas.js";

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const rnd = (n) => Math.floor(Math.random() * n);

/* ==================== MEMÓRIA ==================== */
const SIMBOLOS = ["🍼", "🧸", "🎈", "🐤", "⭐", "🍪", "🚗", "🌙", "🎀", "🐰"];

export function initMemory() {
  const grid = document.getElementById("mem-grid");
  if (!grid) return;

  let cartas, viradas, achados, jogadas, travado, rodando;
  const elInfo = document.getElementById("mem-info");
  const elMsg = document.getElementById("mem-msg");
  const btn = document.getElementById("mem-new");

  function hud() {
    elInfo.textContent = `${achados}/${cartas.length / 2} pares · ${jogadas} jogadas · 🏆 ${getRecord("memory")}`;
  }

  function começar() {
    const pares = shuffle(SIMBOLOS).slice(0, 8);
    cartas = shuffle([...pares, ...pares]).map((s, i) => ({ id: i, s, aberta: false, achada: false }));
    viradas = []; achados = 0; jogadas = 0; travado = false; rodando = true;
    elMsg.textContent = "";
    desenhar(); hud();
  }

  function desenhar() {
    grid.innerHTML = "";
    for (const c of cartas) {
      const b = document.createElement("button");
      b.className = "mem-card" + (c.aberta || c.achada ? " open" : "") + (c.achada ? " done" : "");
      b.textContent = c.aberta || c.achada ? c.s : "?";
      b.onclick = () => virar(c);
      grid.appendChild(b);
    }
  }

  function virar(c) {
    if (!rodando || travado || c.aberta || c.achada) return;
    c.aberta = true; viradas.push(c); desenhar();
    if (viradas.length < 2) return;

    jogadas++; hud();
    const [a, b] = viradas;
    if (a.s === b.s) {
      a.achada = b.achada = true; achados++;
      viradas = []; desenhar(); hud();
      if (achados === cartas.length / 2) fim();
    } else {
      travado = true;
      setTimeout(() => {
        a.aberta = b.aberta = false; viradas = []; travado = false; desenhar();
      }, 700);
    }
  }

  async function fim() {
    rodando = false;
    // 8 pares no mínimo em 8 jogadas: quanto menos jogadas, mais pontos
    const pontos = Math.max(4, 30 - Math.max(0, jogadas - 8));
    const r = await rewardGame(getActiveBaby(), "memory", pontos);
    registerCare();
    elMsg.textContent = r.factor === 0
      ? `Completou em ${jogadas} jogadas — a criança se cansou.`
      : `${r.record ? "🏆 NOVO RECORDE! " : ""}${jogadas} jogadas · +${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
  }

  btn.onclick = começar;
  /* sair = zerar; entrar = jogo novo embaralhado */
  onScreenShown("screen-memory", começar);
  onScreenLeft("screen-memory", começar);
  começar();
}

/* ==================== COLOR MATCH ==================== */
const CORES = [
  { nome: "VERMELHO", hex: "#E05A5A" },
  { nome: "AZUL",     hex: "#5B8FD6" },
  { nome: "VERDE",    hex: "#6BB77B" },
  { nome: "AMARELO",  hex: "#E5B93C" },
  { nome: "ROXO",     hex: "#9A5FC0" },
];

export function initColorMatch() {
  const palco = document.getElementById("cm-word");
  if (!palco) return;

  let pontos, vidas, alvo, rodando, tempo, tempoMax, timer = null;
  const elOps = document.getElementById("cm-options");
  const elHud = document.getElementById("cm-hud");
  const elMsg = document.getElementById("cm-msg");
  const elBar = document.getElementById("cm-timer");
  const btn = document.getElementById("cm-new");

  function hud() {
    elHud.textContent = `${"❤️".repeat(Math.max(0, vidas))}  ${pontos} pts · 🏆 ${getRecord("colormatch")}`;
  }

  function parar() { if (timer) { clearInterval(timer); timer = null; } }

  function rodada() {
    // palavra de uma cor, pintada de OUTRA — vale a cor da TINTA
    const palavra = CORES[rnd(CORES.length)];
    let tinta = CORES[rnd(CORES.length)];
    while (tinta.nome === palavra.nome) tinta = CORES[rnd(CORES.length)];
    alvo = tinta;

    palco.textContent = palavra.nome;
    palco.style.color = tinta.hex;

    // 4 opções: sempre a certa + 3 outras, embaralhadas
    const outras = shuffle(CORES.filter((x) => x.nome !== tinta.nome)).slice(0, 3);
    elOps.innerHTML = "";
    for (const c of shuffle([tinta, ...outras])) {
      const b = document.createElement("button");
      b.className = "cm-op";
      b.style.background = c.hex;
      b.title = c.nome;
      b.onclick = () => responder(c);
      elOps.appendChild(b);
    }

    tempoMax = Math.max(1.2, 3 - pontos * 0.05);
    tempo = tempoMax;
    parar();
    timer = setInterval(() => {
      tempo -= 0.05;
      elBar.style.width = `${Math.max(0, (tempo / tempoMax) * 100)}%`;
      if (tempo <= 0) { parar(); errar("Tempo!"); }
    }, 50);
  }

  function responder(c) {
    if (!rodando) return;
    parar();
    if (c.nome === alvo.nome) { pontos++; hud(); elMsg.textContent = "✅"; rodada(); }
    else errar(`Era ${alvo.nome}`);
  }

  function errar(txt) {
    vidas--; hud(); elMsg.textContent = `❌ ${txt}`;
    if (vidas <= 0) fim(); else setTimeout(rodada, 600);
  }

  async function fim() {
    rodando = false; parar();
    elOps.innerHTML = ""; palco.textContent = "Fim!"; palco.style.color = "var(--ink)";
    btn.hidden = false;
    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "colormatch", pontos);
      registerCare();
      elMsg.textContent = r.factor === 0
        ? `${pontos} pts — a criança se cansou.`
        : `${r.record ? "🏆 NOVO RECORDE! " : ""}${pontos} pts · +${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
    } else elMsg.textContent = "Nenhum ponto desta vez.";
  }

  btn.onclick = () => {
    pontos = 0; vidas = 3; rodando = true; btn.hidden = true;
    elMsg.textContent = ""; hud(); rodada();
  };

  /* volta ao estado "antes de começar" (e mata o cronômetro) */
  function zerar() {
    parar();
    pontos = 0; vidas = 3; rodando = false;
    btn.hidden = false;
    elMsg.textContent = "";
    elOps.innerHTML = "";
    elBar.style.width = "0%";
    palco.textContent = "Toque na COR DA TINTA";
    palco.style.color = "var(--ink)";
    hud();
  }
  onScreenShown("screen-colormatch", zerar);
  onScreenLeft("screen-colormatch", zerar);

  zerar();
}
