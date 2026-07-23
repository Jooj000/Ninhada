/* =====================================================================
 * cliffjump.js — CLIFF JUMP (skate pelos penhascos)
 * ---------------------------------------------------------------------
 * Regras do original (fonte: Poupedia):
 *   - O bebê anda de skate para a direita, acelerando com o tempo.
 *   - Um toque = pulo. Segurar mais tempo = pulo mais alto.
 *   - Tocar de novo NO AR = pulo duplo (só um; depois não dá mais).
 *   - Perde se cair num vão, bater numa pedra, num balão ou na parede
 *     do penhasco (chegar num degrau mais alto do que consegue subir).
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

export function initCliffJump() {
  const canvas = document.getElementById("cj-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 420), H = (canvas.height = 260);

  const GRAV = 0.52, PULO_MIN = -7.2, PULO_MAX = -12.4, SEGURA_MAX = 16;

  let heroi, plats, obst, camX, vel, rodando, morto, lastT = 0, pontos;
  let segurando = 0, pulosUsados = 0;

  function reset() {
    heroi = { x: 90, y: 0, vy: 0, w: 26, h: 26, chao: true };
    // primeira plataforma bem larga para começar tranquilo
    plats = [{ x: 0, larg: 320, topo: H - 60 }];
    obst = [];
    camX = 0; vel = 3.4; pontos = 0;
    rodando = false; morto = false; segurando = 0; pulosUsados = 0;
    heroi.y = plats[0].topo - heroi.h;
    while (plats[plats.length - 1].x + plats[plats.length - 1].larg < W + 600) gerar();
    setOverlay("Toque para começar", "Segure para pular mais alto!");
    desenhar();
  }

  function gerar() {
    const ult = plats[plats.length - 1];
    const dificuldade = Math.min(1, pontos / 60);
    const vao = 45 + Math.random() * (55 + dificuldade * 60);
    const larg = 110 + Math.random() * 150;
    // degrau: sobe ou desce um pouco (subida grande = parede = perde)
    const passo = (Math.random() - 0.45) * (30 + dificuldade * 30);
    const topo = Math.max(H - 150, Math.min(H - 40, ult.topo + passo));
    const nova = { x: ult.x + ult.larg + vao, larg, topo };
    plats.push(nova);

    // pedra em cima da plataforma
    if (Math.random() < 0.35 + dificuldade * 0.2) {
      obst.push({ x: nova.x + 40 + Math.random() * (larg - 80), y: topo - 18, w: 20, h: 18, tipo: "pedra" });
    }
    // balão: obriga a NÃO pular ali
    if (Math.random() < 0.22 + dificuldade * 0.15) {
      obst.push({ x: nova.x + 30 + Math.random() * (larg - 60), y: topo - 96, w: 30, h: 34, tipo: "balao" });
    }
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  function pular() {
    if (!rodando || morto) return;
    if (heroi.chao) { heroi.vy = PULO_MIN; heroi.chao = false; pulosUsados = 1; segurando = 1; }
    else if (pulosUsados === 1) { heroi.vy = PULO_MIN * 0.92; pulosUsados = 2; segurando = 1; }
  }

  function update(dt) {
    if (!rodando || morto) return;

    // segurar = pulo mais alto (some com a gravidade por um tempinho)
    if (segurando > 0 && segurando < SEGURA_MAX && heroi.vy < 0) {
      heroi.vy += (PULO_MAX - PULO_MIN) / SEGURA_MAX * dt * 0.6;
      segurando += dt;
    }

    vel = 3.4 + pontos * 0.02;
    camX += vel * dt;
    heroi.vy += GRAV * dt;
    heroi.y += heroi.vy * dt;

    const hx = camX + heroi.x;
    // plataforma sob os pés
    let sob = null;
    for (const p of plats) if (hx + heroi.w > p.x && hx < p.x + p.larg) sob = p;

    if (sob) {
      const pes = heroi.y + heroi.h;
      if (heroi.vy >= 0 && pes >= sob.topo && pes <= sob.topo + 22 + heroi.vy * dt) {
        heroi.y = sob.topo - heroi.h; heroi.vy = 0;
        if (!heroi.chao) { heroi.chao = true; pulosUsados = 0; }
      } else if (pes > sob.topo + 22) {
        return fim();                                  // bateu na parede do degrau
      } else if (heroi.y + heroi.h < sob.topo) {
        heroi.chao = false;
      }
    } else {
      heroi.chao = false;
    }

    if (heroi.y > H + 40) return fim();                // caiu no vão

    for (const o of obst) {                            // pedras e balões
      if (hx + heroi.w > o.x + 3 && hx < o.x + o.w - 3 &&
          heroi.y + heroi.h > o.y + 3 && heroi.y < o.y + o.h - 3) return fim();
    }

    // pontos: cada plataforma nova ultrapassada
    const passadas = plats.filter((p) => p.x + p.larg < hx).length;
    pontos = Math.max(pontos, passadas);

    while (plats[plats.length - 1].x < camX + W + 600) gerar();
    plats = plats.filter((p) => p.x + p.larg > camX - 100);
    obst = obst.filter((o) => o.x + o.w > camX - 100);
  }

  async function fim() {
    morto = true; rodando = false;
    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "cliffjump", pontos);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${pontos}!` : `Você passou ${pontos} plataformas`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Caiu!", "Toque para tentar de novo");
  }

  function desenhar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#BFE3F5"); g.addColorStop(1, "#F0E4D0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // nuvens
    ctx.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 4; i++) {
      const x = ((i * 170 - camX * 0.25) % (W + 120)) - 60;
      ctx.beginPath(); ctx.ellipse(x, 40 + i * 14, 32, 12, 0, 0, Math.PI * 2); ctx.fill();
    }

    for (const p of plats) {
      const x = p.x - camX;
      if (x > W || x + p.larg < 0) continue;
      ctx.fillStyle = "#8A9A5B";
      ctx.fillRect(x, p.topo, p.larg, 8);                  // grama
      ctx.fillStyle = "#B08968";
      ctx.fillRect(x, p.topo + 8, p.larg, H - p.topo - 8); // terra
    }

    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    for (const o of obst) {
      const x = o.x - camX;
      if (x > W + 40 || x < -40) continue;
      ctx.font = `${o.h + 6}px system-ui, sans-serif`;
      ctx.fillText(o.tipo === "pedra" ? "🪨" : "🎈", x + o.w / 2, o.y + o.h);
    }

    ctx.font = "26px system-ui, sans-serif";
    ctx.fillText("🛹", heroi.x + heroi.w / 2, heroi.y + heroi.h + 8);
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText("👶", heroi.x + heroi.w / 2, heroi.y + heroi.h - 6);
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left"; ctx.font = "bold 16px system-ui, sans-serif"; ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${pontos}`, 12, 26);
    ctx.textAlign = "right"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("cliffjump")}`, W - 12, 26);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t; update(dt); desenhar();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("cj-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", () => { comecar(); pular(); });
  canvas.addEventListener("pointerup", () => { segurando = 0; });
  document.getElementById("cj-overlay").addEventListener("pointerdown", comecar);
  window.addEventListener("keydown", (e) => {
    const tela = document.getElementById("screen-cliffjump");
    if (!tela || !tela.classList.contains("active")) return;
    if (e.code === "Space") { e.preventDefault(); comecar(); pular(); }
  });
  window.addEventListener("keyup", (e) => { if (e.code === "Space") segurando = 0; });

  reset();
  requestAnimationFrame(loop);
}
