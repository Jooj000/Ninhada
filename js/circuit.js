/* =====================================================================
 * circuit.js — FEIRA DE CIÊNCIAS (eletrônica de verdade)
 * ---------------------------------------------------------------------
 * Agora é um laboratório: bateria, resistores, LEDs e chave, com
 * TENSÃO e CORRENTE calculadas de verdade pelo circuit-solver.js.
 *
 * O que se aprende, um nível de cada vez:
 *   1. Lei de Ohm .......... I = V / R
 *   2. Série ............... mesma corrente, tensões se somam
 *   3. Paralelo ............ mesma tensão, correntes se somam
 *   4. LED com resistor .... R = (Vfonte − Vf) / I    (o clássico!)
 *   5. Desafio ............. escolher o resistor certo sozinho
 *
 * Os VALORES são sorteados a cada partida (bateria, resistores, LED),
 * então não dá para decorar: tem que calcular.
 *
 * MULTÍMETRO: toque em qualquer componente para ver V, I e R nele.
 * ===================================================================== */

import { simular, resistorParaLed, fmtA, fmtV, fmtR, serie, paralelo } from "./circuit-solver.js";
import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

const SVGNS = "http://www.w3.org/2000/svg";
const sorteia = (a) => a[Math.floor(Math.random() * a.length)];

/* Valores comerciais de verdade (série E12), como numa gaveta real. */
const RESISTORES = [100, 150, 220, 330, 470, 680, 1000, 1500, 2200];
const BATERIAS = [4.5, 6, 9, 12];
const LEDS = [
  { cor: "#E05A5A", nome: "vermelho", vf: 1.8 },
  { cor: "#6BB77B", nome: "verde",    vf: 2.1 },
  { cor: "#5B8FD6", nome: "azul",     vf: 3.0 },
  { cor: "#E5B93C", nome: "amarelo",  vf: 2.0 },
];

/* ---------------- os 5 níveis ---------------- */
function montarNivel(n) {
  const V = sorteia(BATERIAS);

  if (n === 0) {
    const R = sorteia([100, 220, 330, 470]);
    return {
      titulo: "1 · Lei de Ohm",
      licao: `A Lei de Ohm diz: I = V / R. Feche o circuito e confira no multímetro se a corrente bate com ${V} V ÷ ${fmtR(R)}.`,
      nos: { P:{x:50,y:70,rot:"+"}, M:{x:50,y:210,rot:"−"}, A:{x:170,y:70}, B:{x:170,y:210} },
      fixos: [
        { tipo:"bateria", a:"P", b:"M", volts:V, x:50, y:140 },
        { tipo:"resistor", a:"A", b:"B", ohms:R, x:170, y:140, nome:"R1" },
      ],
      objetivo: (s, comps) => {
        const r = comps.find((c) => c.nome === "R1");
        const i = Math.abs(s.correnteEm(r));
        return { ok: i > 1e-4, dica: `Corrente esperada: ${fmtA(V / R)}` };
      },
      pergunta: () => ({ texto: `Qual a corrente no circuito?`, certo: V / R, unidade: "mA", fator: 1000 }),
    };
  }

  if (n === 1) {
    const R1 = sorteia([100, 220, 330]), R2 = sorteia([220, 470, 680]);
    return {
      titulo: "2 · Resistores em SÉRIE",
      licao: `Em série a corrente é a MESMA nos dois, e as tensões se somam. Rtotal = ${fmtR(R1)} + ${fmtR(R2)} = ${fmtR(serie(R1,R2))}.`,
      nos: { P:{x:45,y:60,rot:"+"}, M:{x:45,y:220,rot:"−"}, A:{x:150,y:60}, B:{x:255,y:60}, C:{x:255,y:220} },
      fixos: [
        { tipo:"bateria", a:"P", b:"M", volts:V, x:45, y:140 },
        { tipo:"resistor", a:"A", b:"B", ohms:R1, x:200, y:60, nome:"R1", horiz:true },
        { tipo:"resistor", a:"B", b:"C", ohms:R2, x:255, y:140, nome:"R2" },
      ],
      objetivo: (s, comps) => {
        const r1 = comps.find((c) => c.nome === "R1");
        return { ok: Math.abs(s.correnteEm(r1)) > 1e-4,
                 dica: `I = ${V}V ÷ ${fmtR(serie(R1,R2))} = ${fmtA(V/serie(R1,R2))}` };
      },
      pergunta: () => ({ texto: `Qual a TENSÃO no R2 (${fmtR(R2)})?`,
                         certo: V * R2 / serie(R1, R2), unidade: "V", fator: 1 }),
    };
  }

  if (n === 2) {
    const R1 = sorteia([100, 220]), R2 = sorteia([330, 470, 680]);
    return {
      titulo: "3 · Resistores em PARALELO",
      licao: `Em paralelo a TENSÃO é a mesma nos dois, e as correntes se somam. O caminho mais fácil (menor Ω) leva mais corrente.`,
      nos: { P:{x:45,y:60,rot:"+"}, M:{x:45,y:220,rot:"−"}, A:{x:150,y:60}, B:{x:150,y:220}, C:{x:265,y:60}, D:{x:265,y:220} },
      fixos: [
        { tipo:"bateria", a:"P", b:"M", volts:V, x:45, y:140 },
        { tipo:"resistor", a:"A", b:"B", ohms:R1, x:150, y:140, nome:"R1" },
        { tipo:"resistor", a:"C", b:"D", ohms:R2, x:265, y:140, nome:"R2" },
      ],
      objetivo: (s, comps) => {
        const r1 = comps.find((c) => c.nome === "R1"), r2 = comps.find((c) => c.nome === "R2");
        const ok = Math.abs(s.correnteEm(r1)) > 1e-4 && Math.abs(s.correnteEm(r2)) > 1e-4;
        return { ok, dica: `Os DOIS ramos precisam conduzir. Req = ${fmtR(Math.round(paralelo(R1,R2)))}` };
      },
      pergunta: () => ({ texto: `Qual a corrente TOTAL saindo da bateria?`,
                         certo: V / paralelo(R1, R2), unidade: "mA", fator: 1000 }),
    };
  }

  if (n === 3) {
    const led = sorteia(LEDS);
    const ideal = resistorParaLed(V, led.vf, 0.018);
    const certo = RESISTORES.reduce((a, b) => (Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a));
    return {
      titulo: "4 · LED com resistor",
      licao: `LED sem resistor QUEIMA. A conta é R = (Vfonte − Vf) ÷ I. Aqui: (${V}V − ${led.vf}V) ÷ 0,018A ≈ ${fmtR(Math.round(ideal))}. Escolha na gaveta e acenda sem queimar!`,
      nos: { P:{x:50,y:60,rot:"+"}, M:{x:50,y:220,rot:"−"}, A:{x:165,y:60}, B:{x:165,y:140}, C:{x:165,y:220} },
      fixos: [
        { tipo:"bateria", a:"P", b:"M", volts:V, x:50, y:140 },
        { tipo:"resistor", a:"A", b:"B", ohms:null, x:165, y:100, nome:"R1", escolher:true },
        { tipo:"led", a:"B", b:"C", vf:led.vf, imax:0.025, x:165, y:180, nome:"LED", cor:led.cor },
      ],
      objetivo: (s, comps) => {
        const l = comps.find((c) => c.nome === "LED");
        const i = s.correnteEm(l);
        const idx = comps.indexOf(l);
        if (s.ledsQueimados[idx]) return { ok:false, falha:true, dica:`QUEIMOU! ${fmtA(i)} é demais (máx 25 mA). Use um resistor MAIOR.` };
        if (!s.ledsAcesos[idx]) return { ok:false, dica:"O LED não acendeu. Confira as ligações e o sentido (+ no lado do ânodo)." };
        if (i < 0.008) return { ok:false, dica:`Só ${fmtA(i)} — acende fraquinho. Use um resistor MENOR.` };
        return { ok:true, dica:`Perfeito! ${fmtA(i)} passando pelo LED ${led.nome}.` };
      },
      escolhas: RESISTORES,
      certo,
    };
  }

  // nível 5: dois LEDs, tem que proteger os dois
  const led = sorteia(LEDS);
  const ideal = resistorParaLed(V, led.vf, 0.015);
  return {
    titulo: "5 · Desafio: dois LEDs",
    licao: `Dois LEDs em paralelo, cada um com seu resistor. Lembre: em paralelo cada ramo recebe a tensão inteira, então cada LED precisa do SEU resistor.`,
    nos: { P:{x:45,y:55,rot:"+"}, M:{x:45,y:225,rot:"−"}, A:{x:150,y:55}, B:{x:150,y:140}, C:{x:150,y:225},
           D:{x:270,y:55}, E:{x:270,y:140}, F:{x:270,y:225} },
    fixos: [
      { tipo:"bateria", a:"P", b:"M", volts:V, x:45, y:140 },
      { tipo:"resistor", a:"A", b:"B", ohms:null, x:150, y:98, nome:"R1", escolher:true },
      { tipo:"led", a:"B", b:"C", vf:led.vf, imax:0.025, x:150, y:182, nome:"LED1", cor:led.cor },
      { tipo:"resistor", a:"D", b:"E", ohms:null, x:270, y:98, nome:"R2", escolher:true },
      { tipo:"led", a:"E", b:"F", vf:led.vf, imax:0.025, x:270, y:182, nome:"LED2", cor:led.cor },
    ],
    objetivo: (s, comps) => {
      const l1 = comps.find((c) => c.nome === "LED1"), l2 = comps.find((c) => c.nome === "LED2");
      const i1 = comps.indexOf(l1), i2 = comps.indexOf(l2);
      if (s.ledsQueimados[i1] || s.ledsQueimados[i2])
        return { ok:false, falha:true, dica:"Queimou um LED! Resistores maiores." };
      if (!s.ledsAcesos[i1] || !s.ledsAcesos[i2])
        return { ok:false, dica:"Os DOIS precisam acender." };
      const a = s.correnteEm(l1), b = s.correnteEm(l2);
      if (a < 0.007 || b < 0.007) return { ok:false, dica:"Fracos demais. Resistores menores." };
      return { ok:true, dica:`Os dois acesos: ${fmtA(a)} e ${fmtA(b)} 🎉` };
    },
    escolhas: RESISTORES,
    certo: RESISTORES.reduce((a, b) => (Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a)),
  };
}

/* ---------------- jogo ---------------- */
export function initCircuit() {
  const root = document.getElementById("circuit-root");
  if (!root) return;

  let nivel = 0, def, fios, sel, resolvido, comps, escolhaAberta = null;
  const status = document.getElementById("circuit-status");
  const titulo = document.getElementById("circuit-level");
  const licao = document.getElementById("circuit-licao");
  const painel = document.getElementById("circuit-medidor");

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 340 280");
  svg.classList.add("circuit-svg");
  root.innerHTML = ""; root.appendChild(svg);

  const el = (t, at) => { const e = document.createElementNS(SVGNS, t);
    for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); return e; };
  const chave = (a, b) => [a, b].sort().join("|");

  function carregar(n) {
    nivel = ((n % 5) + 5) % 5;
    def = montarNivel(nivel);
    comps = def.fixos.map((c) => ({ ...c }));
    fios = new Set(); sel = null; resolvido = false; escolhaAberta = null;
    titulo.textContent = def.titulo;
    licao.textContent = def.licao;
    render();
  }

  /* Junta componentes + fios do jogador e simula. */
  function simularTudo() {
    const listaNos = new Set(Object.keys(def.nos));
    const lista = [];
    for (const c of comps) {
      if (c.tipo === "resistor" && (c.ohms === null || c.ohms === undefined)) continue;  // ainda sem valor
      lista.push(c);
    }
    for (const f of fios) { const [a, b] = f.split("|"); lista.push({ tipo:"fio", a, b }); }
    // o polo negativo da bateria é a referência (terra)
    const bat = comps.find((c) => c.tipo === "bateria");
    const nos = [...listaNos].map((n) => (n === bat.b ? "GND" : n));
    const troca = (x) => (x === bat.b ? "GND" : x);
    const norm = lista.map((c) => ({ ...c, a: troca(c.a), b: troca(c.b) }));
    const s = simular(nos, norm);
    // devolve com os componentes originais para o objetivo saber quem é quem
    return {
      ...s,
      correnteEm: (c) => s.correntes[norm.findIndex((x) => x.nome === c.nome && c.nome)] || 0,
      tensaoEm: (c) => (s.tensoes[troca(c.a)] ?? 0) - (s.tensoes[troca(c.b)] ?? 0),
      ledsAcesos: s.ledsAcesos, ledsQueimados: s.ledsQueimados,
      _norm: norm,
    };
  }

  /* ---------- desenho ---------- */
  function render() {
    const s = simularTudo();
    svg.innerHTML = "";

    // fios do jogador
    for (const f of fios) {
      const [a, b] = f.split("|");
      const A = def.nos[a], B = def.nos[b];
      const i = Math.abs(correnteDoFio(s, a, b));
      svg.appendChild(el("line", { x1:A.x, y1:A.y, x2:B.x, y2:B.y,
        class: "wire" + (i > 0.0005 ? " wire-viva" : "") }));
    }

    for (const c of comps) desenharComp(svg, c, s);

    // nós
    for (const [id, n] of Object.entries(def.nos)) {
      const g = el("g", { class: "node" + (sel === id ? " sel" : "") });
      g.style.cursor = "pointer";
      const tipo = n.rot === "+" ? "plus" : n.rot === "−" ? "minus" : "term";
      g.appendChild(el("circle", { cx:n.x, cy:n.y, r:9, class:"node-dot " + tipo }));
      if (n.rot) { const t = el("text", { x:n.x, y:n.y+4, class:"node-label", "text-anchor":"middle" });
        t.textContent = n.rot; g.appendChild(t); }
      g.addEventListener("click", () => tocarNo(id));
      svg.appendChild(g);
    }

    atualizarMedidor(s);
    conferir(s);
  }

  function correnteDoFio(s, a, b) {
    const bat = comps.find((c) => c.tipo === "bateria");
    const t = (x) => (x === bat.b ? "GND" : x);
    const va = s.tensoes[t(a)] ?? 0, vb = s.tensoes[t(b)] ?? 0;
    return (va - vb) / 1e-3;
  }

  function desenharComp(svg, c, s) {
    const g = el("g", { class: "comp" });
    g.style.cursor = "pointer";
    g.addEventListener("click", () => { medindo = c; render(); });

    if (c.tipo === "bateria") {
      const A = def.nos[c.a], B = def.nos[c.b];
      svg.appendChild(el("line", { x1:A.x, y1:A.y, x2:c.x, y2:c.y-14, class:"comp-lead" }));
      svg.appendChild(el("line", { x1:B.x, y1:B.y, x2:c.x, y2:c.y+14, class:"comp-lead" }));
      g.appendChild(el("rect", { x:c.x-20, y:c.y-16, width:40, height:32, rx:5, class:"bateria" }));
      const t = el("text", { x:c.x, y:c.y+5, class:"comp-val", "text-anchor":"middle" });
      t.textContent = `${c.volts}V`; g.appendChild(t);
    } else if (c.tipo === "resistor") {
      const A = def.nos[c.a], B = def.nos[c.b];
      svg.appendChild(el("line", { x1:A.x, y1:A.y, x2:c.x, y2:c.y, class:"comp-lead" }));
      svg.appendChild(el("line", { x1:B.x, y1:B.y, x2:c.x, y2:c.y, class:"comp-lead" }));
      const horiz = !!c.horiz;
      const w = horiz ? 46 : 26, h = horiz ? 20 : 40;
      g.appendChild(el("rect", { x:c.x-w/2, y:c.y-h/2, width:w, height:h, rx:4,
        class: "resistor" + (c.ohms === null ? " vazio" : "") }));
      const t = el("text", { x:c.x, y:c.y+4, class:"comp-val", "text-anchor":"middle" });
      t.textContent = c.ohms === null ? "?" : fmtR(c.ohms);
      g.appendChild(t);
      if (c.escolher) {
        const b = el("text", { x:c.x, y:c.y-h/2-6, class:"comp-hint", "text-anchor":"middle" });
        b.textContent = "toque p/ escolher"; g.appendChild(b);
        g.addEventListener("click", (e) => { e.stopPropagation(); abrirGaveta(c); });
      }
    } else if (c.tipo === "led") {
      const A = def.nos[c.a], B = def.nos[c.b];
      svg.appendChild(el("line", { x1:A.x, y1:A.y, x2:c.x, y2:c.y-12, class:"comp-lead" }));
      svg.appendChild(el("line", { x1:B.x, y1:B.y, x2:c.x, y2:c.y+12, class:"comp-lead" }));
      const idx = comps.indexOf(c);
      const aceso = s.ledsAcesos[s._norm.findIndex((x) => x.nome === c.nome)];
      const queimado = s.ledsQueimados[s._norm.findIndex((x) => x.nome === c.nome)];
      if (aceso && !queimado) {
        g.appendChild(el("circle", { cx:c.x, cy:c.y, r:22, fill:c.cor, opacity:0.25 }));
      }
      g.appendChild(el("circle", { cx:c.x, cy:c.y, r:12,
        fill: queimado ? "#3A3340" : (aceso ? c.cor : "#6B6478"),
        stroke: queimado ? "#000" : c.cor, "stroke-width": 2 }));
      const t = el("text", { x:c.x+22, y:c.y+4, class:"comp-hint", "text-anchor":"start" });
      t.textContent = queimado ? "queimado" : `Vf ${c.vf}V`;
      g.appendChild(t);
    }
    svg.appendChild(g);
  }

  /* ---------- multímetro ---------- */
  let medindo = null;
  function atualizarMedidor(s) {
    if (!painel) return;
    if (!medindo) {
      painel.innerHTML = `<span class="med-vazio">🔌 Toque num componente para medir</span>`;
      return;
    }
    const v = s.tensaoEm(medindo);
    const i = s.correnteEm(medindo);
    const linhas = [
      `<div class="med-item"><span>Tensão</span><b>${fmtV(Math.abs(v))}</b></div>`,
      `<div class="med-item"><span>Corrente</span><b>${fmtA(Math.abs(i))}</b></div>`,
    ];
    if (medindo.tipo === "resistor" && medindo.ohms)
      linhas.push(`<div class="med-item"><span>Resistência</span><b>${fmtR(medindo.ohms)}</b></div>`,
        `<div class="med-item calc"><span>V = R × I</span><b>${fmtV(medindo.ohms * Math.abs(i))}</b></div>`);
    if (medindo.tipo === "led")
      linhas.push(`<div class="med-item"><span>Vf do LED</span><b>${medindo.vf} V</b></div>`);
    painel.innerHTML = `<div class="med-titulo">📟 ${medindo.nome || "Bateria"}</div>${linhas.join("")}`;
  }

  /* ---------- gaveta de resistores ---------- */
  function abrirGaveta(c) {
    const gav = document.getElementById("circuit-gaveta");
    if (!gav || !def.escolhas) return;
    gav.hidden = false;
    gav.innerHTML = `<div class="gav-titulo">Gaveta de resistores — ${c.nome}</div>`;
    const linha = document.createElement("div");
    linha.className = "gav-linha";
    for (const r of def.escolhas) {
      const b = document.createElement("button");
      b.className = "gav-btn" + (c.ohms === r ? " on" : "");
      b.textContent = fmtR(r);
      b.onclick = () => { c.ohms = r; gav.hidden = true; render(); };
      linha.appendChild(b);
    }
    gav.appendChild(linha);
    const fechar = document.createElement("button");
    fechar.className = "ghost-btn small"; fechar.textContent = "fechar";
    fechar.onclick = () => { gav.hidden = true; };
    gav.appendChild(fechar);
  }

  /* ---------- ligações ---------- */
  function tocarNo(id) {
    if (resolvido) return;
    if (sel === null) { sel = id; render(); return; }
    if (sel === id) { sel = null; render(); return; }
    const k = chave(sel, id);
    if (fios.has(k)) fios.delete(k); else fios.add(k);
    sel = null;
    render();
  }

  async function conferir(s) {
    if (resolvido) return;
    const r = def.objetivo(s, comps);
    if (r.falha) { status.className = "circuit-status ruim"; status.textContent = r.dica; return; }
    if (!r.ok) { status.className = "circuit-status"; status.textContent = r.dica || ""; return; }

    resolvido = true;
    status.className = "circuit-status bom";
    const res = await rewardGame(getActiveBaby(), "circuit", 1);
    registerCare();
    status.textContent = `${r.dica} ` + (res.factor === 0
      ? "(a criança se cansou — sem recompensa agora)"
      : `+${res.coins} 🪙 +${res.xp} XP${res.record ? " 🏆" : ""}`);
  }

  document.getElementById("circuit-clear").onclick = () => { fios.clear(); sel = null; medindo = null; render(); };
  document.getElementById("circuit-new").onclick = () => carregar(nivel + 1);

  carregar(0);
}
