/* =====================================================================
 * circuit.js — FEIRA DE CIÊNCIAS: circuitos progressivos
 * ---------------------------------------------------------------------
 * Vários desafios, do simples ao complexo: lâmpada única, SÉRIE,
 * PARALELO, INTERRUPTOR e RESISTOR. Cada circuito completo paga.
 *
 * MODELO ELÉTRICO (para você, engenheiro):
 *  - Fios do jogador e interruptores FECHADOS = arestas condutoras puras.
 *    Union-find sobre elas gera os "nós elétricos" (componentes).
 *  - Lâmpadas e resistores = arestas de COMPONENTE entre nós elétricos.
 *  - CURTO: + e − caem no MESMO nó elétrico (caminho só de fio). Um
 *    resistor ligando + a − NÃO é curto (ele limita a corrente) — é
 *    justamente a diferença que o jogo ensina.
 *  - LÂMPADA ACESA: existe caminho + → − que ATRAVESSA aquela lâmpada.
 *    Testamos removendo a aresta e vendo se + e − ainda alcançam os dois
 *    terminais dela. Isso resolve série e paralelo corretamente.
 * ===================================================================== */

import { rewardGame } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

const SVGNS = "http://www.w3.org/2000/svg";

/* ---------------- NÍVEIS ---------------- */
const LEVELS = [
  {
    name: "Circuito simples",
    hint: "Ligue + e − passando pela lâmpada.",
    nodes: { P:{x:45,y:95,t:"plus"}, M:{x:45,y:215,t:"minus"},
             A:{x:150,y:120}, B:{x:250,y:120}, J:{x:200,y:245,t:"junction"} },
    comps: [{ type:"lamp", a:"A", b:"B", bulb:{x:200,y:80} }],
  },
  {
    name: "Duas em série",
    hint: "As duas lâmpadas precisam acender no MESMO caminho.",
    nodes: { P:{x:40,y:95}, M:{x:40,y:215},
             A:{x:120,y:110}, B:{x:200,y:110}, C:{x:230,y:180}, D:{x:310,y:180} },
    comps: [{ type:"lamp", a:"A", b:"B", bulb:{x:160,y:70} },
            { type:"lamp", a:"C", b:"D", bulb:{x:270,y:140} }],
  },
  {
    name: "Em paralelo",
    hint: "Cada lâmpada no seu ramo — as duas acesas ao mesmo tempo.",
    nodes: { P:{x:40,y:150}, M:{x:330,y:150},
             A:{x:130,y:80}, B:{x:240,y:80}, C:{x:130,y:220}, D:{x:240,y:220} },
    comps: [{ type:"lamp", a:"A", b:"B", bulb:{x:185,y:55} },
            { type:"lamp", a:"C", b:"D", bulb:{x:185,y:250} }],
  },
  {
    name: "Com interruptor",
    hint: "Monte o circuito e LIGUE a chave (toque nela).",
    nodes: { P:{x:40,y:110}, M:{x:40,y:220},
             A:{x:150,y:100}, B:{x:250,y:100}, S1:{x:150,y:230}, S2:{x:250,y:230} },
    comps: [{ type:"lamp", a:"A", b:"B", bulb:{x:200,y:60} },
            { type:"switch", a:"S1", b:"S2", closed:false }],
  },
  {
    name: "Resistor protetor",
    hint: "O resistor não é curto: use-o para fechar o circuito com segurança.",
    nodes: { P:{x:40,y:110}, M:{x:40,y:225},
             A:{x:150,y:95}, B:{x:255,y:95}, R1:{x:150,y:225}, R2:{x:255,y:225} },
    comps: [{ type:"lamp", a:"A", b:"B", bulb:{x:200,y:55} },
            { type:"resistor", a:"R1", b:"R2" }],
  },
];

export function initCircuit() {
  const root = document.getElementById("circuit-root");
  if (!root) return;

  let li = 0, level, wires, selected, solved, comps;
  const status = document.getElementById("circuit-status");
  const titleEl = document.getElementById("circuit-level");

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 360 300");
  svg.classList.add("circuit-svg");
  root.innerHTML = ""; root.appendChild(svg);

  function load(i) {
    li = ((i % LEVELS.length) + LEVELS.length) % LEVELS.length;
    level = LEVELS[li];
    comps = level.comps.map((c) => ({ ...c }));   // cópia (interruptor guarda estado)
    wires = new Set(); selected = null; solved = false;
    if (titleEl) titleEl.textContent = `${li + 1}/${LEVELS.length} · ${level.name}`;
    render();
  }

  const key = (a, b) => [a, b].sort().join("|");

  /* --- núcleo elétrico --- */
  function analyse() {
    const ids = Object.keys(level.nodes);
    const parent = {}; ids.forEach((n) => (parent[n] = n));
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const uni = (a, b) => (parent[find(a)] = find(b));

    for (const w of wires) { const [a, b] = w.split("|"); uni(a, b); }
    for (const c of comps) if (c.type === "switch" && c.closed) uni(c.a, c.b);  // chave fechada = fio

    const short = find("P") === find("M");

    // grafo entre nós elétricos usando componentes (lâmpada/resistor)
    const edges = comps.filter((c) => c.type === "lamp" || c.type === "resistor");
    const reach = (from, to, skip) => {          // BFS ignorando a aresta `skip`
      const start = find(from), target = find(to);
      if (start === target) return true;
      const seen = new Set([start]); const q = [start];
      while (q.length) {
        const cur = q.shift();
        for (const e of edges) {
          if (e === skip) continue;
          const ea = find(e.a), eb = find(e.b);
          let nxt = null;
          if (ea === cur) nxt = eb; else if (eb === cur) nxt = ea;
          if (nxt && !seen.has(nxt)) {
            if (nxt === target) return true;
            seen.add(nxt); q.push(nxt);
          }
        }
      }
      return false;
    };

    // uma lâmpada acende se há caminho + → − ATRAVESSANDO ela
    for (const c of edges) {
      if (c.type !== "lamp") continue;
      c.on = !short && (
        (reach("P", c.a, c) && reach("M", c.b, c)) ||
        (reach("P", c.b, c) && reach("M", c.a, c))
      );
    }
    const allOn = edges.filter((e) => e.type === "lamp").every((l) => l.on);
    return { short, allOn };
  }

  /* --- desenho --- */
  const el = (tag, attrs) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  async function render() {
    const { short, allOn } = analyse();
    svg.innerHTML = "";

    for (const w of wires) {
      const [a, b] = w.split("|");
      svg.appendChild(el("line", { x1: level.nodes[a].x, y1: level.nodes[a].y,
        x2: level.nodes[b].x, y2: level.nodes[b].y, class: "wire" + (short ? " wire-short" : "") }));
    }

    for (const c of comps) {
      const A = level.nodes[c.a], B = level.nodes[c.b];
      if (c.type === "lamp") {
        const bx = c.bulb.x, by = c.bulb.y;
        svg.appendChild(el("line", { x1:A.x, y1:A.y, x2:bx, y2:by+24, class:"bulb-lead" }));
        svg.appendChild(el("line", { x1:B.x, y1:B.y, x2:bx, y2:by+24, class:"bulb-lead" }));
        svg.appendChild(el("circle", { cx:bx, cy:by, r:22, class:"bulb" + (c.on ? " lit" : "") }));
      } else if (c.type === "resistor") {
        svg.appendChild(el("line", { x1:A.x, y1:A.y, x2:B.x, y2:B.y, class:"res-lead" }));
        const mx = (A.x+B.x)/2, my = (A.y+B.y)/2;
        svg.appendChild(el("rect", { x:mx-26, y:my-10, width:52, height:20, rx:4, class:"resistor" }));
        const t = el("text", { x:mx, y:my+5, class:"comp-label", "text-anchor":"middle" });
        t.textContent = "Ω"; svg.appendChild(t);
      } else if (c.type === "switch") {
        svg.appendChild(el("line", { x1:A.x, y1:A.y, x2:B.x, y2:B.y, class:"sw-base" }));
        const mx = (A.x+B.x)/2, my = (A.y+B.y)/2;
        const g = el("g", { class: "sw" + (c.closed ? " on" : "") });
        g.style.cursor = "pointer";
        g.appendChild(el("rect", { x:mx-28, y:my-14, width:56, height:28, rx:14, class:"sw-body" }));
        g.appendChild(el("circle", { cx: mx + (c.closed ? 12 : -12), cy: my, r:10, class:"sw-knob" }));
        g.addEventListener("click", () => { c.closed = !c.closed; check(); });
        svg.appendChild(g);
      }
    }

    for (const [id, n] of Object.entries(level.nodes)) {
      const g = el("g", { class: "node" + (selected === id ? " sel" : "") });
      g.style.cursor = "pointer";
      const cls = id === "P" ? "plus" : id === "M" ? "minus" : (n.t === "junction" ? "junction" : "term");
      g.appendChild(el("circle", { cx:n.x, cy:n.y, r:12, class:"node-dot " + cls }));
      const lab = id === "P" ? "+" : id === "M" ? "−" : (n.t === "junction" ? "J" : "");
      if (lab) { const t = el("text", { x:n.x, y:n.y+5, class:"node-label", "text-anchor":"middle" }); t.textContent = lab; g.appendChild(t); }
      g.addEventListener("click", () => onNode(id));
      svg.appendChild(g);
    }

    if (short) {
      const s = el("text", { x:180, y:285, class:"spark", "text-anchor":"middle" });
      s.textContent = "⚡ CURTO! ⚡"; svg.appendChild(s);
      status.textContent = "Curto-circuito! O + não pode chegar no − só por fio.";
      setTimeout(() => { wires.clear(); selected = null; render(); }, 900);
    } else if (!solved) {
      status.textContent = level.hint;
    }
    return allOn;
  }

  async function check() {
    const allOn = await render();
    if (allOn && !solved) {
      solved = true;
      const r = await rewardGame(getActiveBaby(), "circuit", 1);
      registerCare();
      status.textContent = r.factor === 0
        ? "💡 Circuito completo! (a criança se cansou — sem recompensa agora)"
        : `💡 Circuito completo! +${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
      render();
    }
  }

  function onNode(id) {
    if (solved) return;
    if (selected === null) { selected = id; render(); return; }
    if (selected === id) { selected = null; render(); return; }
    const k = key(selected, id);
    if (wires.has(k)) wires.delete(k); else wires.add(k);
    selected = null;
    check();
  }

  document.getElementById("circuit-clear").onclick = () => { wires.clear(); selected = null; render(); };
  document.getElementById("circuit-new").onclick = () => load(li + 1);

  load(0);
}
