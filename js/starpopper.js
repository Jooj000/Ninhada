/* =====================================================================
 * starpopper.js — STAR POPPER (fiel ao original do Pou)
 * ---------------------------------------------------------------------
 * Diferenças em relação a um Puzzle Bobble comum:
 *   - A massa é RADIAL e gira em torno de um POU PRETO central, que é
 *     âncora permanente (não sai, não pontua, não tem cor jogável).
 *   - A rotação NÃO é automática: nasce do TORQUE dos impactos, com
 *     velocidade angular + atrito, até parar sozinha.
 *   - Ao estourar um grupo, tudo que ficar DESCONECTADO do Pou preto
 *     evapora também (e pontua).
 *   - A massa CRESCE sozinha por um temporizador, na periferia.
 *   - Rodada limpa (só o Pou preto) => nova massa com +1 cor.
 *   - Errar o tiro (sair pelo topo) custa pontos.
 *   - Algumas bolhas têm MOEDA dentro: rendem moedas extras ao sair.
 *   - Derrota: qualquer bolha alcança o círculo-limite da arena.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { STARPOPPER as SP } from "./config.js";

const PALETA = ["#E05A5A", "#5B8FD6", "#6BB77B", "#E5B93C", "#9A5FC0"];
const PRETO = "#2B2438";
const R = 12;                              // raio da bolha
const S = (2 * R) / 1.7320508;             // tamanho do hex p/ encostarem
const VIZ = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

const hexParaLocal = (q, r) => ({ x: S * 1.7320508 * (q + r / 2), y: S * 1.5 * r });
function localParaHex(x, y) {
  const r = y / (S * 1.5), q = x / (S * 1.7320508) - r / 2;
  let rx = Math.round(q), ry = Math.round(-q - r), rz = Math.round(r);
  const dx = Math.abs(rx - q), dy = Math.abs(ry - (-q - r)), dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}
const K = (q, r) => q + "," + r;
const desK = (k) => { const [q, r] = k.split(",").map(Number); return { q, r }; };

/* ---- núcleo puro (testável fora do navegador) ---- */

/* Tudo que NÃO alcança o Pou preto (0,0) andando por vizinhos. */
export function ilhasSoltas(massa) {
  const vistos = new Set(["0,0"]);
  const fila = [{ q: 0, r: 0 }];
  while (fila.length) {
    const a = fila.pop();
    for (const [dq, dr] of VIZ) {
      const q = a.q + dq, r = a.r + dr, k = K(q, r);
      if (vistos.has(k) || !massa.has(k)) continue;
      vistos.add(k); fila.push({ q, r });
    }
  }
  return [...massa.keys()].filter((k) => !vistos.has(k));
}

/* Grupo conectado da mesma cor a partir de um hex. */
export function grupoMesmaCor(massa, h) {
  const cor = massa.get(K(h.q, h.r));
  if (!cor || cor === PRETO) return [];
  const grupo = [], vistos = new Set([K(h.q, h.r)]), fila = [h];
  while (fila.length) {
    const a = fila.pop(); grupo.push(a);
    for (const [dq, dr] of VIZ) {
      const q = a.q + dq, r = a.r + dr, k = K(q, r);
      if (vistos.has(k) || massa.get(k) !== cor) continue;
      vistos.add(k); fila.push({ q, r });
    }
  }
  return grupo;
}

/* Células vazias na periferia, priorizando manter o formato circular. */
export function candidatosPeriferia(massa) {
  const vazias = new Map();
  for (const k of massa.keys()) {
    const a = desK(k);
    for (const [dq, dr] of VIZ) {
      const q = a.q + dq, r = a.r + dr, kk = K(q, r);
      if (massa.has(kk)) continue;
      const p = hexParaLocal(q, r);
      vazias.set(kk, Math.hypot(p.x, p.y));
    }
  }
  const lista = [...vazias.entries()].sort((a, b) => a[1] - b[1]);
  if (!lista.length) return [];
  const menor = lista[0][1];
  return lista.filter(([, d]) => d <= menor + S * 1.2).map(([k]) => k);
}

/* Cores que AINDA existem na massa (o Pou preto não conta).
 * É a peça central para a rodada poder terminar: uma cor que você
 * eliminou NÃO volta — nem no canhão, nem no crescimento. */
export function coresVivas(massa) {
  const cont = new Map();
  for (const c of massa.values()) if (c !== PRETO) cont.set(c, (cont.get(c) || 0) + 1);
  return cont;
}

/* Sorteio ponderado pelas cores presentes (mais frequente = mais provável). */
export function sortearCor(massa, fallback = null) {
  const cont = coresVivas(massa);
  if (!cont.size) return fallback || PALETA[0];
  const total = [...cont.values()].reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [cor, n] of cont) { r -= n; if (r <= 0) return cor; }
  return [...cont.keys()][0];
}

/* ---------------- jogo ---------------- */
export function initStarPopper() {
  const canvas = document.getElementById("sp-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 340), H = (canvas.height = 460);
  const CX = W / 2, CY = H * 0.40;
  const LIMITE = Math.min(CX, CY) - R - 4;
  const BOCA = { x: CX, y: H - 30 };

  const CRESCE_MS = (SP.cresceSegundos ?? 35) * 1000;
  const PENALIDADE = SP.penalidade ?? 5;

  let massa, ang, vAng, bala, atual, proxima, mira;
  let pontos, moedas, rodada, nCores, rodando, morto, lastT = 0, cresceEm;

  /* ---- montagem da massa ---- */
  function coresDaRodada() { return PALETA.slice(0, nCores); }

  function novaMassa() {
    massa = new Map();
    massa.set("0,0", PRETO);                       // Pou preto: âncora
    const cores = coresDaRodada();
    for (const [dq, dr] of VIZ) {
      const cor = cores[Math.floor(Math.random() * cores.length)];
      massa.set(K(dq, dr), cor);
      if (Math.random() < 0.15) marcarMoeda(K(dq, dr));
    }
    for (let i = 0; i < 8; i++) crescer(true);   // massa inicial com as cores da rodada
    cresceEm = CRESCE_MS;
  }

  const moedasEm = new Set();
  function marcarMoeda(k) { moedasEm.add(k); }

  /* Uma bolha nova na periferia. `usarRodada` só no começo da partida,
   * quando ainda faz sentido introduzir todas as cores da rodada. */
  function crescer(usarRodada = false) {
    const cand = candidatosPeriferia(massa);
    if (!cand.length) return;
    const k = cand[Math.floor(Math.random() * cand.length)];

    let cor;
    if (usarRodada) {
      const cores = coresDaRodada();
      cor = cores[Math.floor(Math.random() * cores.length)];
    } else {
      // IMPORTANTE: só cores que ainda estão na massa. Sem isso, uma cor
      // recém-eliminada voltava e a rodada nunca terminava.
      const vivas = [...coresVivas(massa).keys()];
      if (!vivas.length) return;                  // limpou tudo: nada a fazer
      cor = vivas[Math.floor(Math.random() * vivas.length)];
    }
    massa.set(k, cor);
    if (Math.random() < (SP.chanceMoeda ?? 0.1)) marcarMoeda(k);
  }

  /* ONDA de crescimento: várias bolhas de uma vez, de tempos em tempos. */
  function ondaDeCrescimento() {
    const n = (SP.bolhasPorOnda ?? 5) + (rodada - 1) * (SP.bolhasPorOndaExtra ?? 1);
    for (let i = 0; i < n; i++) crescer(false);
  }

  function reset() {
    moedasEm.clear();
    nCores = SP.coresIniciais ?? 2; rodada = 1;
    pontos = 0; moedas = 0;
    ang = 0; vAng = 0; bala = null;
    rodando = false; morto = false; mira = -Math.PI / 2;
    novaMassa();
    atual = sortearCor(massa); proxima = sortearCor(massa, atual);
    setOverlay("Toque para começar", "Junte 3+ da mesma cor");
    desenhar();
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  /* ---- conversões mundo <-> massa ---- */
  const paraLocal = (x, y) => {
    const dx = x - CX, dy = y - CY, c = Math.cos(-ang), s = Math.sin(-ang);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  };
  const paraMundo = (x, y) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    return { x: CX + x * c - y * s, y: CY + x * s + y * c };
  };

  /* ---- disparo ---- */
  function atirar() {
    if (!rodando || morto || bala) return;
    bala = { x: BOCA.x, y: BOCA.y, vx: Math.cos(mira) * 7.6, vy: Math.sin(mira) * 7.6, cor: atual };
    atual = proxima; proxima = sortearCor(massa, atual);
  }

  function encaixar() {
    const loc = paraLocal(bala.x, bala.y);
    let h = localParaHex(loc.x, loc.y);
    if (massa.has(K(h.q, h.r))) {
      let melhor = null, dist = Infinity;
      for (const [dq, dr] of VIZ) {
        const q = h.q + dq, r = h.r + dr;
        if (massa.has(K(q, r))) continue;
        const p = hexParaLocal(q, r);
        const d = Math.hypot(p.x - loc.x, p.y - loc.y);
        if (d < dist) { dist = d; melhor = { q, r }; }
      }
      if (!melhor) { bala = null; return; }
      h = melhor;
    }

    // TORQUE = r × v (produto vetorial em 2D). O SINAL sai naturalmente:
    // bater à esquerda do centro gira para um lado, à direita para o outro.
    const c = Math.cos(-ang), sn = Math.sin(-ang);
    const vx = bala.vx * c - bala.vy * sn;      // velocidade no referencial da massa
    const vy = bala.vx * sn + bala.vy * c;
    const torque = loc.x * vy - loc.y * vx;    // componente z do produto vetorial
    vAng += (torque / 1000) * (SP.torque ?? 0.115);
    const teto = SP.giroMax ?? 0.05;
    vAng = Math.max(-teto, Math.min(teto, vAng));

    massa.set(K(h.q, h.r), bala.cor);
    if (Math.random() < 0.06) marcarMoeda(K(h.q, h.r));
    bala = null;

    const grupo = grupoMesmaCor(massa, h);
    if (grupo.length >= 3) {
      for (const g of grupo) remover(K(g.q, g.r));
      // ilhas que perderam ligação com o Pou preto também evaporam
      for (const k of ilhasSoltas(massa)) remover(k);
    }

    if (massa.size === 1) proximaRodada();       // só sobrou o Pou preto
    else if (encostouBorda()) fim();
  }

  function remover(k) {
    if (!massa.has(k) || massa.get(k) === PRETO) return;
    massa.delete(k);
    pontos += 1;
    if (moedasEm.has(k)) { moedas++; moedasEm.delete(k); }
  }

  function proximaRodada() {
    rodada++;
    nCores = Math.min(PALETA.length, nCores + 1);   // +1 cor por rodada limpa
    moedasEm.clear();
    novaMassa();
    atual = sortearCor(massa); proxima = sortearCor(massa, atual);
    vAng = 0;
  }

  function encostouBorda() {
    for (const k of massa.keys()) {
      const { q, r } = desK(k);
      const p = hexParaLocal(q, r);
      if (Math.hypot(p.x, p.y) > LIMITE) return true;
    }
    return false;
  }

  /* ---- loop ---- */
  function update(dt) {
    if (!rodando || morto) return;

    ang += vAng * dt;
    vAng *= Math.pow(SP.atrito ?? 0.9903, dt);    // atrito: para sozinho em ~10 s
    if (Math.abs(vAng) < (SP.pisoGiro ?? 0.0001)) vAng = 0;

    cresceEm -= dt * (1000 / 60);
    if (cresceEm <= 0) {
      ondaDeCrescimento(); cresceEm = CRESCE_MS;
      if (encostouBorda()) return fim();
    }

    if (bala) {
      bala.x += bala.vx * dt; bala.y += bala.vy * dt;
      if (bala.x < R) { bala.x = R; bala.vx *= -1; }
      if (bala.x > W - R) { bala.x = W - R; bala.vx *= -1; }
      if (bala.y < -R * 2) {                     // errou: saiu pelo topo
        bala = null;
        pontos = Math.max(0, pontos - PENALIDADE);
        return;
      }
      for (const k of massa.keys()) {
        const { q, r } = desK(k);
        const p = hexParaLocal(q, r), m = paraMundo(p.x, p.y);
        if (Math.hypot(m.x - bala.x, m.y - bala.y) < R * 1.9) return encaixar();
      }
    }
  }

  async function fim() {
    morto = true; rodando = false;
    const total = pontos + moedas * 5;           // bolhas + bônus das moedinhas
    if (total > 0) {
      const r = await rewardGame(getActiveBaby(), "starpopper", total, pontos);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${pontos}!` : `${pontos} bolhas · 🪙${moedas}`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("A massa encostou na borda!", "Toque para tentar de novo");
  }

  /* ---- desenho ---- */
  function bolha(x, y, cor, moeda) {
    if (cor === PRETO) {                      // Pou preto: âncora, não é cor jogável
      ctx.fillStyle = PRETO;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, R - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff";                 // olhinhos
      ctx.beginPath(); ctx.arc(x - R * 0.3, y - R * 0.1, R * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + R * 0.3, y - R * 0.1, R * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1;
      return;
    }
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.26)";
    ctx.beginPath(); ctx.arc(x - R * 0.3, y - R * 0.35, R * 0.3, 0, Math.PI * 2); ctx.fill();
    if (moeda) {
      ctx.font = `${R}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🪙", x, y);
      ctx.textBaseline = "alphabetic";
    }
  }

  /* Faixa de mira com a largura da bolha, já com os ricochetes. */
  function desenharMira() {
    let x = BOCA.x, y = BOCA.y, vx = Math.cos(mira) * 7.6, vy = Math.sin(mira) * 7.6;
    const pts = [{ x, y }];
    for (let i = 0; i < 260; i++) {
      x += vx; y += vy;
      if (x < R || x > W - R) { vx *= -1; pts.push({ x, y }); }
      if (y < 0) break;
      let bateu = false;
      for (const k of massa.keys()) {
        const { q, r } = desK(k);
        const p = hexParaLocal(q, r), m = paraMundo(p.x, p.y);
        if (Math.hypot(m.x - x, m.y - y) < R * 1.9) { bateu = true; break; }
      }
      if (bateu) break;
    }
    pts.push({ x, y });
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = R * 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function desenhar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#221E33"); g.addColorStop(1, "#3E3559");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(CX, CY, LIMITE + R, 0, Math.PI * 2); ctx.stroke();

    if (rodando && !morto && !bala) desenharMira();

    for (const [k, cor] of massa) {
      const { q, r } = desK(k);
      const p = hexParaLocal(q, r), m = paraMundo(p.x, p.y);
      bolha(m.x, m.y, cor, moedasEm.has(k));
    }
    if (bala) bolha(bala.x, bala.y, bala.cor);

    // canhão: bolha atual + próxima
    bolha(BOCA.x, BOCA.y, atual);
    if (SP.mostrarProxima !== false) {
      ctx.globalAlpha = 0.5; bolha(BOCA.x + 44, BOCA.y + 8, proxima); ctx.globalAlpha = 1;
      ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = "#C9BFD4";
      ctx.textAlign = "center"; ctx.fillText("próxima", BOCA.x + 44, BOCA.y + 26);
    }

    ctx.textAlign = "left"; ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillStyle = "#fff";
    ctx.fillText(`${pontos}  🪙${moedas}`, 12, 24);
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.fillStyle = "#C9BFD4";
    ctx.fillText(`rodada ${rodada} · ${coresVivas(massa).size} cores · onda em ${Math.ceil(cresceEm / 1000)}s`, 12, 42);
    ctx.textAlign = "right";
    ctx.fillText(`🏆 ${getRecord("starpopper")}`, W - 12, 24);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t; update(dt); desenhar();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("sp-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  const apontar = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const a = Math.atan2(y - BOCA.y, x - BOCA.x);
    mira = Math.max(-Math.PI * 0.95, Math.min(-Math.PI * 0.05, a));
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { comecar(); apontar(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.buttons) apontar(e); });
  canvas.addEventListener("pointerup", () => { if (rodando && !morto) atirar(); });
  document.getElementById("sp-overlay").addEventListener("pointerdown", comecar);

  reset();
  requestAnimationFrame(loop);
}
