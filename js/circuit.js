/* =====================================================================
 * circuit.js — MINIGAME "FEIRA DE CIÊNCIAS": acenda a lâmpada
 * ---------------------------------------------------------------------
 * Objetivo: ligar o polo + ao polo − PASSANDO pela lâmpada, formando um
 * circuito fechado. Se você ligar + direto no − (ou pelo desvio J),
 * dá CURTO (faísca) e os fios se apagam.
 *
 * Como jogar: clique num terminal e depois em outro para criar um fio.
 * Clicar de novo no mesmo par remove o fio.
 *
 * Modelagem elétrica (para você, engenheiro):
 *  - A lâmpada é uma "aresta componente" fixa entre L1 e L2.
 *  - Os fios são arestas comuns. Usamos union-find só com os fios:
 *      • + e − no mesmo conjunto (só por fios)  => CURTO.
 *      • + liga a um terminal da lâmpada e − ao outro => malha fechada
 *        passando pela lâmpada => ACENDE.
 *  (Polaridade não importa numa lâmpada resistiva. Para um LED, importaria
 *   — deixei isso como gancho de nível futuro nos comentários.)
 * ===================================================================== */

import { rewardGame } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { GAME_CONFIG } from "./config.js";

const SVGNS = "http://www.w3.org/2000/svg";
const REWARD = 20;

// Terminais e posições (viewBox 360x300)
const NODES = {
  PLUS:  { x: 46,  y: 95,  label: "+", cls: "pole plus" },
  MINUS: { x: 46,  y: 205, label: "–", cls: "pole minus" },
  L1:    { x: 155, y: 120, label: "",  cls: "term" },
  L2:    { x: 245, y: 120, label: "",  cls: "term" },
  J:     { x: 200, y: 240, label: "J", cls: "junction" }, // desvio-armadilha
};

export function initCircuit() {
  const root = document.getElementById("circuit-root");
  if (!root) return;

  let wires = new Set();     // chaves "A|B"
  let selected = null;
  let solved = false;

  const status = document.getElementById("circuit-status");

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 360 300");
  svg.classList.add("circuit-svg");
  root.innerHTML = "";
  root.appendChild(svg);

  function key(a, b) { return [a, b].sort().join("|"); }

  /* ---- union-find só com os fios (a lâmpada NÃO entra aqui) ---- */
  function connected() {
    const parent = {};
    Object.keys(NODES).forEach((n) => (parent[n] = n));
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const uni = (a, b) => (parent[find(a)] = find(b));
    for (const w of wires) { const [a, b] = w.split("|"); uni(a, b); }
    const same = (a, b) => find(a) === find(b);
    return { same };
  }

  function evaluate() {
    const { same } = connected();
    if (same("PLUS", "MINUS")) return "short";
    const throughLamp =
      (same("PLUS", "L1") && same("MINUS", "L2")) ||
      (same("PLUS", "L2") && same("MINUS", "L1"));
    return throughLamp ? "on" : "idle";
  }

  async function render() {
    const state = evaluate();
    svg.innerHTML = "";

    // Fios
    for (const w of wires) {
      const [a, b] = w.split("|");
      const line = el("line", {
        x1: NODES[a].x, y1: NODES[a].y, x2: NODES[b].x, y2: NODES[b].y,
        class: "wire" + (state === "short" ? " wire-short" : ""),
      });
      svg.appendChild(line);
    }

    // Lâmpada (aresta componente L1-L2) + bulbo
    svg.appendChild(el("line", { x1: NODES.L1.x, y1: NODES.L1.y, x2: NODES.L2.x, y2: NODES.L2.y, class: "bulb-wire" }));
    const bulb = el("circle", { cx: 200, cy: 78, r: 26, class: "bulb" + (state === "on" ? " lit" : "") });
    svg.appendChild(bulb);
    svg.appendChild(el("line", { x1: NODES.L1.x, y1: NODES.L1.y, x2: 200, y2: 104, class: "bulb-lead" }));
    svg.appendChild(el("line", { x1: NODES.L2.x, y1: NODES.L2.y, x2: 200, y2: 104, class: "bulb-lead" }));

    // Bateria (símbolo entre + e -)
    svg.appendChild(el("line", { x1: 46, y1: 95, x2: 46, y2: 205, class: "batt-body" }));

    // Nós clicáveis
    for (const [id, n] of Object.entries(NODES)) {
      const g = el("g", { class: "node" + (selected === id ? " sel" : "") });
      g.style.cursor = "pointer";
      g.appendChild(el("circle", { cx: n.x, cy: n.y, r: 12, class: "node-dot " + n.cls }));
      if (n.label) {
        const t = el("text", { x: n.x, y: n.y + 5, class: "node-label", "text-anchor": "middle" });
        t.textContent = n.label;
        g.appendChild(t);
      }
      g.addEventListener("click", () => onNodeClick(id));
      svg.appendChild(g);
    }

    // Faísca no curto
    if (state === "short") {
      const s = el("text", { x: 200, y: 160, class: "spark", "text-anchor": "middle" });
      s.textContent = "⚡ CURTO! ⚡";
      svg.appendChild(s);
      status.textContent = "Curto-circuito! O + não pode ligar direto no −.";
      setTimeout(() => { wires.clear(); selected = null; render(); }, 900);
    } else if (state === "on") {
      if (!solved) {
        solved = true;
        const r = await rewardGame(getActiveBaby(), "circuit", 1);   // paga por circuito
        registerCare();
        status.textContent = r.factor === 0
          ? "Lâmpada acesa 💡 (a criança se cansou — sem recompensa agora)"
          : `Lâmpada acesa! +${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
        render();
      } else {
        status.textContent = "Lâmpada acesa 💡 — toque em Novo desafio";
      }
    } else {
      status.textContent = "Ligue o + e o − passando pela lâmpada.";
    }
  }

  function onNodeClick(id) {
    if (solved) return;              // trave até "Novo desafio"
    if (selected === null) { selected = id; render(); return; }
    if (selected === id) { selected = null; render(); return; }
    const k = key(selected, id);
    if (wires.has(k)) wires.delete(k); else wires.add(k);
    selected = null;
    render();
  }

  document.getElementById("circuit-clear").onclick = () => { wires.clear(); selected = null; render(); };
  document.getElementById("circuit-new").onclick   = () => { wires.clear(); selected = null; solved = false; render(); };

  render();
}

/* helper: cria elemento SVG com atributos */
function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
