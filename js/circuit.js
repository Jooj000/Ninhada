/* =====================================================================
 * circuit.js — FEIRA DE CIÊNCIAS (montagem de circuitos numa GRID)
 * ---------------------------------------------------------------------
 * O tabuleiro é uma grade. A bateria, as lâmpadas e (às vezes) um
 * resistor já vêm posicionados; a criança escolhe uma peça na paleta
 * (fio reto, curva, T, cruz) e toca nas casas para ENCAIXAR o caminho.
 * Tocar de novo na mesma casa com a mesma peça GIRA a peça.
 *
 * A eletricidade é DE VERDADE: as peças viram nós e componentes e o
 * circuit-solver.js resolve tensões e correntes (análise nodal).
 *
 * Progressão:
 *   - 4 desafios INTRODUTÓRIOS fixos (o tutorial);
 *   - depois, DESAFIOS ALEATÓRIOS infinitos: posições, orientações e
 *     objetivo sorteados (acender 1, 2 livres, em série, em paralelo,
 *     ou proteger a lâmpada com o resistor).
 * ===================================================================== */

import { simular } from "./circuit-solver.js";
import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { onScreenShown, onScreenLeft } from "./fs-canvas.js";

const SVGNS = "http://www.w3.org/2000/svg";
const COLS = 7, ROWS = 7, CEL = 48;
const W = COLS * CEL, H = ROWS * CEL;

/* portas de cada célula: N, E, S, W (índices 0..3) */
const LADOS = ["N", "E", "S", "W"];
const OPOSTO = { N: "S", S: "N", E: "W", W: "E" };
const DELTA = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };

/* Cada FAMÍLIA de peça define as portas ligadas na rotação 0;
 * girar = avançar cada porta uma casa em N→E→S→W. */
const FAMILIAS = {
  reto:  { rots: 2, portas: ["N", "S"], icone: "│" },
  curva: { rots: 4, portas: ["N", "E"], icone: "└" },
  te:    { rots: 4, portas: ["N", "E", "S"], icone: "├" },
  cruz:  { rots: 1, portas: ["N", "E", "S", "W"], icone: "┼" },
};
const gira = (lado, r) => LADOS[(LADOS.indexOf(lado) + r) % 4];
const portasDe = (fam, rot) => FAMILIAS[fam].portas.map((p) => gira(p, rot));

/* ---- constantes elétricas (afinadas para o jogo) ---- */
const R_LAMP = 40;        // Ω de cada lampadinha
const I_ACESA = 0.03;     // acima disso, acende
const I_QUEIMA = 0.2;     // acima disso, QUEIMA
const I_CURTO = 3;        // corrente absurda na bateria = curto-circuito

export function initCircuit() {
  const root = document.getElementById("circuit-root");
  if (!root) return;

  const status = document.getElementById("circuit-status");
  const titulo = document.getElementById("circuit-level");
  const licao = document.getElementById("circuit-licao");
  const paleta = document.getElementById("circuit-palette");

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.classList.add("circuit-svg");
  root.innerHTML = ""; root.appendChild(svg);

  const el = (t, at) => {
    const e = document.createElementNS(SVGNS, t);
    for (const [k, v] of Object.entries(at)) e.setAttribute(k, v);
    return e;
  };

  /* estado da partida */
  let nivel = 0;            // 0..3 = tutorial; 4+ = aleatórios
  let desafio = null;       // { titulo, texto, fixos:[{tipo,r,c,rot,...}], pecasExtra }
  let grade = null;         // grade[r][c] = null | {fam,rot} | {fixo:true,...}
  let selecionada = "reto";
  let resolvido = false;
  let recompensando = false;

  const dentro = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

  /* =================== GERAÇÃO DOS DESAFIOS ===================== */
  const rnd = (n) => Math.floor(Math.random() * n);
  const sorteia = (a) => a[rnd(a.length)];

  function celulaLivre(g, usadas) {
    for (let t = 0; t < 200; t++) {
      const r = 1 + rnd(ROWS - 2), c = 1 + rnd(COLS - 2);   // longe da borda
      const k = r + "," + c;
      // exige uma "almofada" de 1 casa: nenhum componente colado no outro
      const perto = [...usadas].some((u) => {
        const [ur, uc] = u.split(",").map(Number);
        return Math.abs(ur - r) <= 1 && Math.abs(uc - c) <= 1;
      });
      if (!usadas.has(k) && !perto) { usadas.add(k); return { r, c }; }
    }
    return null;
  }

  function montarFixos(specs) {
    const usadas = new Set();
    const out = [];
    for (const s of specs) {
      const pos = celulaLivre(null, usadas);
      if (!pos) return null;
      out.push({ ...s, ...pos, rot: rnd(2) });   // deitado ou em pé, sorteado
    }
    return out;
  }

  /* tutorial: 4 tabuleiros fixos e didáticos */
  function tutorial(n) {
    if (n === 0) return {
      titulo: "Tutorial 1/4",
      texto: "Feche o caminho da BATERIA até a LÂMPADA com fios retos. " +
             "Escolha a peça embaixo e toque nas casas vazias. " +
             "Tocar de novo GIRA a peça!",
      volts: 6,
      fixos: [
        { tipo: "bateria", r: 3, c: 1, rot: 1 },     // terminais E/W
        { tipo: "lampada", r: 3, c: 5, rot: 1, nome: "L1" },
      ],
      extra: [],
      meta: { tipo: "acender", quais: ["L1"] },
    };
    if (n === 1) return {
      titulo: "Tutorial 2/4",
      texto: "Agora a lâmpada está em OUTRA linha: você vai precisar das " +
             "CURVAS para o caminho dobrar. Lembre: tocar de novo gira!",
      volts: 6,
      fixos: [
        { tipo: "bateria", r: 5, c: 1, rot: 1 },
        { tipo: "lampada", r: 1, c: 5, rot: 1, nome: "L1" },
      ],
      extra: [],
      meta: { tipo: "acender", quais: ["L1"] },
    };
    if (n === 2) return {
      titulo: "Tutorial 3/4",
      texto: "DUAS lâmpadas! Use a peça T para o caminho se dividir " +
             "(paralelo: as duas brilham forte) ou passe por uma e depois " +
             "pela outra (série: brilham fraquinho). Você escolhe!",
      volts: 6,
      fixos: [
        { tipo: "bateria", r: 3, c: 1, rot: 1 },
        { tipo: "lampada", r: 1, c: 4, rot: 1, nome: "L1" },
        { tipo: "lampada", r: 5, c: 4, rot: 1, nome: "L2" },
      ],
      extra: [],
      meta: { tipo: "acender", quais: ["L1", "L2"] },
    };
    return {
      titulo: "Tutorial 4/4",
      texto: "Essa bateria de 12 V é FORTE DEMAIS: ligada direto, a lâmpada " +
             "queima! Coloque o RESISTOR (peça nova na paleta) no meio do " +
             "caminho para segurar a corrente.",
      volts: 12,
      fixos: [
        { tipo: "bateria", r: 3, c: 1, rot: 1 },
        { tipo: "lampada", r: 3, c: 5, rot: 1, nome: "L1" },
      ],
      extra: ["resistor"],
      meta: { tipo: "acender", quais: ["L1"] },
    };
  }

  /* desafios aleatórios: posições, orientações e objetivo sorteados */
  function aleatorio(n) {
    const tema = sorteia(["um", "dois", "serie", "paralelo", "resistor", "resistor"]);
    const numero = n - 3;

    if (tema === "um") {
      const fixos = montarFixos([
        { tipo: "bateria" }, { tipo: "lampada", nome: "L1" },
      ]);
      return fixos && {
        titulo: `Desafio ${numero}`, volts: sorteia([4.5, 6, 9]),
        texto: "Monte o caminho e ACENDA a lâmpada. Cuidado para não fechar " +
               "um caminho só de fios (curto-circuito!).",
        fixos, extra: [], meta: { tipo: "acender", quais: ["L1"] },
      };
    }
    if (tema === "dois") {
      const fixos = montarFixos([
        { tipo: "bateria" }, { tipo: "lampada", nome: "L1" }, { tipo: "lampada", nome: "L2" },
      ]);
      return fixos && {
        titulo: `Desafio ${numero}`, volts: 6,
        texto: "Acenda as DUAS lâmpadas — em série ou em paralelo, como preferir.",
        fixos, extra: [], meta: { tipo: "acender", quais: ["L1", "L2"] },
      };
    }
    if (tema === "serie") {
      const fixos = montarFixos([
        { tipo: "bateria" }, { tipo: "lampada", nome: "L1" }, { tipo: "lampada", nome: "L2" },
      ]);
      return fixos && {
        titulo: `Desafio ${numero}`, volts: 6,
        texto: "Acenda as duas lâmpadas EM SÉRIE: um caminho só, passando " +
               "pelas duas — elas dividem a tensão e brilham fraquinho igual.",
        fixos, extra: [], meta: { tipo: "serie", quais: ["L1", "L2"] },
      };
    }
    if (tema === "paralelo") {
      const fixos = montarFixos([
        { tipo: "bateria" }, { tipo: "lampada", nome: "L1" }, { tipo: "lampada", nome: "L2" },
      ]);
      return fixos && {
        titulo: `Desafio ${numero}`, volts: 6,
        texto: "Acenda as duas EM PARALELO: o caminho se divide (use o T!) " +
               "e cada lâmpada recebe a força inteira da bateria.",
        fixos, extra: [], meta: { tipo: "paralelo", quais: ["L1", "L2"] },
      };
    }
    // resistor: bateria forte, lâmpada queima sem proteção
    const fixos = montarFixos([
      { tipo: "bateria" }, { tipo: "lampada", nome: "L1" },
    ]);
    return fixos && {
      titulo: `Desafio ${numero}`, volts: 12,
      texto: "Bateria de 12 V! Direto na lâmpada, ela QUEIMA. Encaixe o " +
             "RESISTOR no caminho para ela acender protegida.",
      fixos, extra: ["resistor"], meta: { tipo: "acender", quais: ["L1"] },
    };
  }

  function carregar(n) {
    if (typeof proximoT !== "undefined" && proximoT) { clearTimeout(proximoT); proximoT = null; }
    nivel = Math.max(0, n);
    desafio = nivel < 4 ? tutorial(nivel) : null;
    for (let t = 0; !desafio && t < 30; t++) desafio = aleatorio(nivel);
    if (!desafio) desafio = tutorial(0);

    grade = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (const f of desafio.fixos) {
      grade[f.r][f.c] = { fixo: true, ...f };
    }
    resolvido = false; recompensando = false;
    titulo.textContent = desafio.titulo + ` · 🏆 ${getRecord("circuit")}`;
    licao.textContent = desafio.texto;
    montarPaleta();
    avaliarERenderizar();
  }

  /* =================== PALETA DE PEÇAS ========================== */
  function montarPaleta() {
    paleta.innerHTML = "";
    const opcoes = [
      { id: "reto", rotulo: "─ fio" },
      { id: "curva", rotulo: "└ curva" },
      { id: "te", rotulo: "├ T" },
      { id: "cruz", rotulo: "┼ cruz" },
      ...(desafio.extra.includes("resistor") ? [{ id: "resistor", rotulo: "⏛ resistor" }] : []),
      { id: "apagar", rotulo: "🧽 apagar" },
    ];
    if (!opcoes.some((o) => o.id === selecionada)) selecionada = "reto";
    for (const o of opcoes) {
      const b = document.createElement("button");
      b.className = "pal-btn" + (selecionada === o.id ? " on" : "");
      b.textContent = o.rotulo;
      b.onclick = () => { selecionada = o.id; montarPaleta(); };
      paleta.appendChild(b);
    }
  }

  /* =================== TOQUE NAS CASAS ========================== */
  function tocar(r, c) {
    if (resolvido) return;
    const cel = grade[r][c];
    if (cel && cel.fixo) return;                    // componente do desafio: não mexe

    if (selecionada === "apagar") { grade[r][c] = null; avaliarERenderizar(); return; }

    if (selecionada === "resistor") {
      // só existe UM resistor: colocar de novo o move; tocar nele gira
      if (cel && cel.fam === "resistor") { cel.rot = (cel.rot + 1) % 2; }
      else {
        for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
          const g = grade[rr][cc];
          if (g && g.fam === "resistor") grade[rr][cc] = null;
        }
        grade[r][c] = { fam: "resistor", rot: 0 };
      }
      avaliarERenderizar(); return;
    }

    const fam = FAMILIAS[selecionada];
    if (cel && cel.fam === selecionada) cel.rot = (cel.rot + 1) % fam.rots;   // gira
    else grade[r][c] = { fam: selecionada, rot: 0 };                          // coloca
    avaliarERenderizar();
  }

  /* =================== GRADE → CIRCUITO ========================= */
  function portasDaCelula(cel) {
    if (!cel) return [];
    if (cel.fixo) {
      // bateria/lâmpada: terminais em lados opostos conforme a rotação
      return cel.rot % 2 ? ["E", "W"] : ["N", "S"];
    }
    if (cel.fam === "resistor") return cel.rot % 2 ? ["N", "S"] : ["E", "W"];
    return portasDe(cel.fam, cel.rot);
  }

  function montarCircuito() {
    /* união de portas: cada porta ativa é um nó; fios unem as próprias
     * portas; casas vizinhas unem as portas que se encaram. */
    const pai = new Map();
    const acha = (x) => {
      while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); }
      return x;
    };
    const une = (a, b) => { const ra = acha(a), rb = acha(b); if (ra !== rb) pai.set(ra, rb); };
    const pid = (r, c, lado) => r + "," + c + "," + lado;

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      for (const p of portasDaCelula(grade[r][c])) {
        const k = pid(r, c, p);
        if (!pai.has(k)) pai.set(k, k);
      }
    }
    // fios (reto/curva/T/cruz) ligam as próprias portas entre si
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cel = grade[r][c];
      if (!cel || cel.fixo || cel.fam === "resistor") continue;
      const ps = portasDaCelula(cel);
      for (let i = 1; i < ps.length; i++) une(pid(r, c, ps[0]), pid(r, c, ps[i]));
    }
    // vizinhos que se encaram
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      for (const p of portasDaCelula(grade[r][c])) {
        const [dr, dc] = DELTA[p];
        const nr = r + dr, nc = c + dc;
        if (!dentro(nr, nc)) continue;
        const op = OPOSTO[p];
        if (portasDaCelula(grade[nr][nc]).includes(op)) une(pid(r, c, p), pid(nr, nc, op));
      }
    }

    // componentes: elemento entre os nós dos seus dois terminais
    const comps = [];
    let bateria = null;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cel = grade[r][c];
      if (!cel) continue;
      const ps = portasDaCelula(cel);
      if (cel.fixo && cel.tipo === "bateria") {
        // o "+" fica na 1ª porta (E na horizontal, N na vertical)
        bateria = { tipo: "bateria", a: acha(pid(r, c, ps[0])), b: acha(pid(r, c, ps[1])),
                    volts: desafio.volts, r, c };
        comps.push(bateria);
      } else if (cel.fixo && cel.tipo === "lampada") {
        comps.push({ tipo: "resistor", ohms: R_LAMP, nome: cel.nome, lampada: true,
                     a: acha(pid(r, c, ps[0])), b: acha(pid(r, c, ps[1])), r, c });
      } else if (cel.fam === "resistor") {
        comps.push({ tipo: "resistor", ohms: 100, nome: "Rprot",
                     a: acha(pid(r, c, ps[0])), b: acha(pid(r, c, ps[1])), r, c });
      }
    }

    if (!bateria) return null;
    // nomes de nós: raiz da união; o "−" da bateria é o GND
    const gnd = bateria.b;
    const troca = (x) => (x === gnd ? "GND" : x);
    const nos = new Set(["GND"]);
    for (const cp of comps) { cp.a = troca(cp.a); cp.b = troca(cp.b); nos.add(cp.a); nos.add(cp.b); }
    return { nos: [...nos], comps, bateria };
  }

  /* =================== AVALIAÇÃO ================================ */
  function avaliar() {
    const cir = montarCircuito();
    if (!cir) return { estado: "montando" };
    // + e − no MESMO nó = existe um caminho só de fios entre eles
    if (cir.bateria.a === cir.bateria.b) return { estado: "curto", info: [] };
    const s = simular(cir.nos, cir.comps);
    const iBat = Math.abs(s.correnteEm(cir.bateria));
    const lamps = cir.comps.filter((c) => c.lampada);
    const info = lamps.map((l) => ({
      nome: l.nome,
      i: Math.abs(s.correnteEm(l)),
      v: Math.abs(s.tensoes[l.a] - s.tensoes[l.b]),
      r: l.r, c: l.c,
    }));

    if (iBat > I_CURTO) return { estado: "curto", info, iBat };
    if (info.some((l) => l.i > I_QUEIMA)) return { estado: "queimou", info, iBat };

    const meta = desafio.meta;
    const acesas = info.filter((l) => l.i > I_ACESA);
    const todas = meta.quais.every((n) => acesas.some((l) => l.nome === n));

    if (!todas) return { estado: "montando", info, iBat };

    const V = desafio.volts;
    if (meta.tipo === "serie") {
      const ok = info.every((l) => l.v > V * 0.3 && l.v < V * 0.7) &&
                 Math.abs(info[0].v - info[1].v) < V * 0.12;
      return { estado: ok ? "ok" : "quase", info, iBat,
               dica: ok ? "" : "Acenderam, mas não em SÉRIE: precisa ser um caminho ÚNICO passando pelas duas." };
    }
    if (meta.tipo === "paralelo") {
      const ok = info.every((l) => l.v > V * 0.8);
      return { estado: ok ? "ok" : "quase", info, iBat,
               dica: ok ? "" : "Acenderam, mas não em PARALELO: cada uma precisa receber a tensão INTEIRA (caminhos separados)." };
    }
    return { estado: "ok", info, iBat };
  }

  let proximoT = null;
  async function concluir() {
    if (recompensando) return;
    recompensando = true; resolvido = true;
    const pts = nivel < 4 ? 2 : 4;                  // desafio aleatório paga mais
    const r = await rewardGame(getActiveBaby(), "circuit", pts);
    registerCare();
    status.textContent = "🎉 Circuito perfeito! " +
      (r.factor === 0 ? "(a criança se cansou)" : `+${r.coins} 🪙 +${r.xp} XP`) +
      " — indo para o próximo…";
    proximoT = setTimeout(() => carregar(nivel + 1), 1800);
  }

  /* =================== DESENHO ================================== */
  function desenhar(res) {
    svg.innerHTML = "";
    // casinhas
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      svg.appendChild(el("rect", {
        x: c * CEL + 2, y: r * CEL + 2, width: CEL - 4, height: CEL - 4,
        rx: 8, class: "cir-cel", "data-r": r, "data-c": c,
      }));
    }

    const meio = CEL / 2;
    const pontaXY = (r, c, lado) => {
      const cx = c * CEL + meio, cy = r * CEL + meio;
      if (lado === "N") return [cx, r * CEL];
      if (lado === "S") return [cx, (r + 1) * CEL];
      if (lado === "E") return [(c + 1) * CEL, cy];
      return [c * CEL, cy];
    };

    const acesaEm = new Map();
    const queimaEm = new Map();
    if (res.info) for (const l of res.info) {
      acesaEm.set(l.r + "," + l.c, l.i > I_ACESA && l.i <= I_QUEIMA ? l.i : 0);
      queimaEm.set(l.r + "," + l.c, l.i > I_QUEIMA);
    }

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cel = grade[r][c];
      if (!cel) continue;
      const cx = c * CEL + meio, cy = r * CEL + meio;

      if (!cel.fixo && cel.fam !== "resistor") {
        for (const p of portasDaCelula(cel)) {
          const [x2, y2] = pontaXY(r, c, p);
          svg.appendChild(el("line", { x1: cx, y1: cy, x2, y2, class: "cir-fio" }));
        }
        svg.appendChild(el("circle", { cx, cy, r: 4.5, class: "cir-fio-no" }));
        continue;
      }

      if (cel.fam === "resistor") {
        for (const p of portasDaCelula(cel)) {
          const [x2, y2] = pontaXY(r, c, p);
          svg.appendChild(el("line", { x1: cx, y1: cy, x2, y2, class: "cir-fio" }));
        }
        const g = el("g", { transform: `translate(${cx} ${cy}) rotate(${cel.rot % 2 ? 90 : 0})` });
        g.appendChild(el("rect", { x: -15, y: -8, width: 30, height: 16, rx: 5, class: "cir-resistor" }));
        const t = el("text", { x: 0, y: 4, class: "cir-rotulo" }); t.textContent = "100Ω";
        g.appendChild(t);
        svg.appendChild(g);
        continue;
      }

      if (cel.tipo === "bateria") {
        for (const p of portasDaCelula(cel)) {
          const [x2, y2] = pontaXY(r, c, p);
          svg.appendChild(el("line", { x1: cx, y1: cy, x2, y2, class: "cir-fio" }));
        }
        const g = el("g", { transform: `translate(${cx} ${cy}) rotate(${cel.rot % 2 ? 0 : 90})` });
        g.appendChild(el("rect", { x: -18, y: -12, width: 36, height: 24, rx: 6, class: "cir-bateria" }));
        const tp = el("text", { x: 10, y: 5, class: "cir-polo" }); tp.textContent = "+";
        const tm = el("text", { x: -12, y: 5, class: "cir-polo" }); tm.textContent = "−";
        g.appendChild(tp); g.appendChild(tm);
        svg.appendChild(g);
        const tv = el("text", { x: cx, y: cy - 16, class: "cir-rotulo destaque" });
        tv.textContent = desafio.volts + "V";
        svg.appendChild(tv);
        continue;
      }

      if (cel.tipo === "lampada") {
        for (const p of portasDaCelula(cel)) {
          const [x2, y2] = pontaXY(r, c, p);
          svg.appendChild(el("line", { x1: cx, y1: cy, x2, y2, class: "cir-fio" }));
        }
        const i = acesaEm.get(r + "," + c) || 0;
        const queimou = queimaEm.get(r + "," + c);
        const brilho = Math.min(1, i / 0.15);
        const b = el("circle", {
          cx, cy, r: 13,
          class: "cir-lamp" + (queimou ? " queimada" : i ? " acesa" : ""),
        });
        if (i && !queimou) b.style.filter = `drop-shadow(0 0 ${4 + brilho * 10}px #FFE55C)`;
        svg.appendChild(b);
        const t = el("text", { x: cx, y: cy + 4, class: "cir-lamp-icone" });
        t.textContent = queimou ? "💥" : "💡";
        svg.appendChild(t);
      }
    }
  }

  function avaliarERenderizar() {
    const res = avaliar();
    desenhar(res);
    if (res.estado === "curto") {
      status.textContent = "⚡ CURTO-CIRCUITO! Um caminho só de fios liga o + no − da bateria. Desfaça!";
    } else if (res.estado === "queimou") {
      status.textContent = "💥 A lâmpada QUEIMOU: corrente demais. Tire o caminho (ou proteja com o resistor).";
    } else if (res.estado === "quase") {
      status.textContent = "💡 " + res.dica;
    } else if (res.estado === "ok") {
      status.textContent = "";
      concluir();
    } else {
      status.textContent = desafio.meta.quais.length > 1
        ? "Ligue a bateria às lâmpadas…"
        : "Ligue a bateria à lâmpada…";
    }
  }

  /* =================== ENTRADA ================================== */
  svg.addEventListener("pointerdown", (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const c = Math.floor(x / CEL), r = Math.floor(y / CEL);
    if (dentro(r, c)) tocar(r, c);
  });

  document.getElementById("circuit-clear").onclick = () => {
    if (resolvido) return;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (grade[r][c] && !grade[r][c].fixo) grade[r][c] = null;
    }
    avaliarERenderizar();
  };
  document.getElementById("circuit-new").onclick = () => carregar(nivel + 1);

  /* sair da tela = zerar o progresso: volta ao tutorial */
  onScreenShown("screen-circuit", () => carregar(0));
  onScreenLeft("screen-circuit", () => carregar(0));
  carregar(0);
}
