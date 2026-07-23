/* =====================================================================
 * skyjump.js — SKY JUMP em TELA CHEIA (estilo Doodle Jump)
 * ---------------------------------------------------------------------
 * O bebê pula sozinho; arraste (ou incline) para os lados. A física
 * vertical é ABSOLUTA (px), então a altura do pulo é a mesma em qualquer
 * tela — só entram MAIS plataformas na vertical em telas altas.
 * Pontos = 1 a cada 100 m; as 🪙 pegas pagam 1:1 por fora.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { SKYJUMP as SJ } from "./config.js";
import { desenharBebe } from "./baby-sprite.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

export function initSkyJump() {
  const canvas = document.getElementById("sj-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-skyjump");
  const ctx = view.ctx;

  let W = 360, H = 640, LARG = 66, N_PLATS = 8;
  const ALT = 12;
  const GRAV = SJ.gravidade, PULO = -SJ.forcaPulo;
  const VAO_MIN = SJ.vaoMin, VAO_MAX = SJ.vaoMax;
  const sorteiaVao = () => VAO_MIN + Math.random() * (VAO_MAX - VAO_MIN);

  let heroi, plats, altura, camera, rodando, morto, lastT = 0, alvoX = null;
  let moedas;

  function medidas() {
    if (view.fit()) { W = view.w; H = view.h; }
    LARG = Math.max(58, Math.min(96, W * 0.18));
    // o vão é FIXO (física absoluta) — tela alta = mais plataformas visíveis
    N_PLATS = Math.ceil(H / ((VAO_MIN + VAO_MAX) / 2)) + 3;
  }

  function novaPlat(y) {
    const quebra = altura > 300 && Math.random() < SJ.chanceQuebra;
    const p = { x: 10 + Math.random() * (W - LARG - 20), y, quebra, usada: false };
    if (Math.random() < SJ.chanceMoeda) p.moeda = { dy: -26, pego: false };
    return p;
  }

  function reset() {
    medidas();
    heroi = { x: W / 2 - 16, y: H - 120, vy: 0, vx: 0, w: 32, h: 32 };
    plats = [{ x: W / 2 - LARG / 2, y: H - 60, quebra: false, usada: false }];
    { let y = H - 60; for (let i = 1; i < N_PLATS; i++) { y -= sorteiaVao(); plats.push(novaPlat(y)); } }
    altura = 0; camera = 0; rodando = false; morto = false; alvoX = null;
    moedas = 0; lastT = 0;
    setOverlay("Toque para começar", "Arraste para os lados!");
    desenhar();
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; heroi.vy = PULO; setOverlay("", ""); }
  }

  function update(dt) {
    if (!rodando || morto) return;

    /* horizontal: o dedo manda; sem dedo, vale a inclinação.
     * TUDO devagarinho de propósito: teto de velocidade E de aceleração. */
    const VMAX = SJ.velMaxH ?? SJ.velMaxToque ?? 6;
    const AMAX = (SJ.acelMax ?? 0.55) * dt;
    let alvoVx = 0;
    if (alvoX !== null) {
      alvoVx = (alvoX - (heroi.x + heroi.w / 2)) * (SJ.seguirFator ?? 0.09);
    } else if (tiltLigado) {
      alvoVx = Math.abs(inclinacao) < 0.05 ? 0 : inclinacao * (SJ.velMaxInclinacao ?? 6);
    } else {
      alvoVx = heroi.vx * 0.9;     // sem entrada: perde velocidade suave
    }
    alvoVx = Math.max(-VMAX, Math.min(VMAX, alvoVx));
    // acelera (e desacelera) no máximo AMAX por passo — nada de tranco
    heroi.vx += Math.max(-AMAX, Math.min(AMAX, alvoVx - heroi.vx));
    heroi.x += heroi.vx * dt;
    if (heroi.x + heroi.w < 0) heroi.x = W;       // atravessa a borda
    else if (heroi.x > W) heroi.x = -heroi.w;

    heroi.vy += GRAV * dt;
    heroi.y += heroi.vy * dt;

    if (heroi.vy > 0) {
      for (const p of plats) {
        if (p.sumiu) continue;
        const emCima = heroi.y + heroi.h >= p.y && heroi.y + heroi.h <= p.y + ALT + heroi.vy * dt;
        const dentro = heroi.x + heroi.w > p.x && heroi.x < p.x + LARG;
        if (emCima && dentro) {
          heroi.vy = PULO;
          if (p.quebra) p.sumiu = true;
          break;
        }
      }
    }

    if (heroi.y < H * 0.4) {
      const d = H * 0.4 - heroi.y;
      heroi.y += d; camera += d; altura += d;
      for (const p of plats) p.y += d;
    }

    plats = plats.filter((p) => p.y < H + 30);
    while (plats.length < N_PLATS) {
      const maisAlta = Math.min(...plats.map((p) => p.y));
      plats.push(novaPlat(maisAlta - sorteiaVao()));
    }

    for (const p of plats) {
      if (!p.moeda || p.moeda.pego) continue;
      const mx = p.x + LARG / 2, my = p.y + p.moeda.dy;
      if (Math.abs(heroi.x + heroi.w / 2 - mx) < 24 &&
          Math.abs(heroi.y + heroi.h / 2 - my) < 26) {
        p.moeda.pego = true; moedas++;
      }
    }

    if (heroi.y > H + 40) fim();
  }

  const metros = () => Math.floor(altura / 10);
  /* 1 ponto a cada 100 m. As 🪙 NÃO viram pontos: pagam 1:1 por fora. */
  const pontos = () => Math.floor(metros() / 100);

  async function fim() {
    morto = true; rodando = false;
    const p = pontos();
    if (p > 0 || moedas > 0) {
      const r = await rewardGame(getActiveBaby(), "skyjump", p, metros(), moedas);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${metros()} m!` : `Você subiu ${metros()} m · 🪙${moedas}`,
        r.factor === 0 && moedas === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Caiu!", "Toque para tentar de novo");
  }

  function desenhar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#CFE8F7"); g.addColorStop(1, "#EAF4FB");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    const nNuvens = Math.ceil(H / 110);
    for (let i = 0; i < nNuvens; i++) {
      const y = ((i * 120 + camera * 0.25) % (H + 80)) - 40;
      ctx.beginPath();
      ctx.ellipse(40 + ((i * 97) % Math.max(80, W - 80)), y, 38, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of plats) {
      if (p.sumiu) continue;
      ctx.fillStyle = p.quebra ? "#E0A0A0" : "#7EC8A0";
      ctx.beginPath(); ctx.roundRect(p.x, p.y, LARG, ALT, 6); ctx.fill();
      if (p.moeda && !p.moeda.pego) {
        ctx.font = "20px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🪙", p.x + LARG / 2, p.y + p.moeda.dy);
      }
    }
    ctx.textBaseline = "alphabetic";

    desenharBebe(ctx, heroi.x + heroi.w / 2, heroi.y + heroi.h, 42,
                 { espelhar: heroi.vx < -0.4 });

    ctx.textAlign = "left";
    ctx.font = "bold 18px system-ui, sans-serif"; ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${metros()} m · 🪙 ${moedas}`, 14, 34);
    ctx.textAlign = "right"; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("skyjump")}`, W - 14, 34);
    if (tiltLigado) {
      ctx.fillStyle = "rgba(74,63,85,.5)";
      ctx.fillText("📱 incline o celular", W - 14, 54);
    }
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t; update(dt); desenhar();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("sj-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  /* ---------------- INCLINAÇÃO (só celular) ---------------- */
  let inclinacao = 0, tiltLigado = false;

  const ehCelular = () =>
    window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

  function ouvirInclinacao() {
    if (tiltLigado) return;
    tiltLigado = true;
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma == null) return;
      const g = SJ.grausMax ?? 18;
      inclinacao = Math.max(-g, Math.min(g, e.gamma)) / g;
    });
  }

  async function ligarInclinacao() {
    if (!ehCelular()) return;
    const D = window.DeviceOrientationEvent;
    if (!D) return;
    if (typeof D.requestPermission === "function") {     // iOS 13+
      try {
        const r = await D.requestPermission();
        if (r === "granted") ouvirInclinacao();
      } catch (_) { /* recusou: fica no toque */ }
    } else {
      ouvirInclinacao();                                  // Android
    }
  }

  const seguir = (e) => {
    const rect = canvas.getBoundingClientRect();
    alvoX = ((e.clientX - rect.left) / rect.width) * W;
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { ligarInclinacao(); comecar(); seguir(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.buttons) seguir(e); });
  canvas.addEventListener("pointerup", () => { alvoX = null; });
  canvas.addEventListener("pointercancel", () => { alvoX = null; });
  document.getElementById("sj-overlay").addEventListener("pointerdown", () => { ligarInclinacao(); comecar(); });

  window.addEventListener("keydown", (e) => {
    const tela = document.getElementById("screen-skyjump");
    if (!tela || !tela.classList.contains("active")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); alvoX = heroi.x - 60; }
    if (e.key === "ArrowRight") { e.preventDefault(); alvoX = heroi.x + 92; }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") alvoX = null;
  });

  view.onResize = reset;
  onScreenShown("screen-skyjump", reset);
  onScreenLeft("screen-skyjump", reset);
  reset();
  requestAnimationFrame(loop);
}
