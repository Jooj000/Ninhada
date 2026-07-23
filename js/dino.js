/* =====================================================================
 * dino.js — "DINO CORRIDA" em TELA CHEIA e resolução real
 * ---------------------------------------------------------------------
 * O canvas cobre a tela toda e desenha na resolução do aparelho
 * (devicePixelRatio) — nada de meia dúzia de pixels esticados.
 * Tudo é dimensionado por um fator de escala `s` derivado da tela,
 * então o jogo fica proporcional em qualquer celular.
 * Sair da tela reseta a corrida.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { desenharBebe } from "./baby-sprite.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

export function initDino() {
  /* Conta as partidas. Uma recompensa que chega DEPOIS de o jogador
   * já ter recomeçado pertence a outra partida e deve ser ignorada —
   * era isso que fazia a tela de morte reaparecer por cima do jogo. */
  let runId = 0;
  const canvas = document.getElementById("dino-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-dino");
  const ctx = view.ctx;

  let W = 360, H = 640, s = 1, GROUND = 460, GRAVITY = 0.62, JUMP = -11.5;

  let dino, obstacles, speed, dist, running, dead, ducking, spawnIn = 0;
  let lastT = 0;

  function medidas() {
    if (view.fit()) { W = view.w; H = view.h; }
    s = Math.max(1, Math.min(2.4, H / 420));   // fator de escala da tela
    GROUND = H * 0.72;
    GRAVITY = 0.62 * s;
    JUMP = -11.5 * s;
  }

  function reset() {
    runId++;                      // nova partida: invalida recompensas pendentes
    medidas();
    dino = { x: W * 0.16, y: GROUND, vy: 0, w: 30 * s, h: 40 * s, onGround: true };
    obstacles = [];
    speed = 6 * s;
    dist = 0;
    running = false;
    dead = false;
    ducking = false;
    spawnIn = 60;
    lastT = 0;
    draw();
    setOverlay("Toque para começar", "Pule os cactos!");
  }

  const score = () => Math.floor(dist / (10 * s));

  function jump() {
    if (dead) { reset(); return; }
    setOverlay("", "");           // sempre limpa: nunca deixa a tela de morte presa
    running = true;
    if (dino.onGround) { dino.vy = JUMP; dino.onGround = false; }
  }

  function spawn() {
    if (Math.random() < 0.25 && score() > 20) {
      obstacles.push({ x: W + 20, y: GROUND - 55 * s, w: 34 * s, h: 24 * s, bird: true, flap: 0 });
    } else {
      const h = (28 + Math.random() * 26) * s;
      const w = (14 + Math.random() * 16) * s;
      obstacles.push({ x: W + 20, y: GROUND - h, w, h, bird: false });
    }
    spawnIn = Math.max(45, 95 - (speed / s) * 3) + Math.random() * 45;
  }

  function update(dt) {
    if (!running || dead) return;

    dist += speed * dt;
    speed = s * (6 + score() / 260);            // acelera devagar

    dino.vy += GRAVITY * dt;
    dino.y += dino.vy * dt;
    if (dino.y >= GROUND) { dino.y = GROUND; dino.vy = 0; dino.onGround = true; }

    const dh = ducking && dino.onGround ? 22 * s : dino.h;
    const dw = ducking && dino.onGround ? 44 * s : dino.w;

    spawnIn -= dt;
    if (spawnIn <= 0) spawn();

    for (const o of obstacles) {
      o.x -= speed * dt;
      if (o.bird) o.flap += 0.2 * dt;
      const dx = dino.x, dy = dino.y - dh;
      if (dx < o.x + o.w && dx + dw > o.x && dy < o.y + o.h && dy + dh > o.y) return gameOver();
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -10);
  }

  async function gameOver() {
    dead = true;
    running = false;
    const sc = score();
    setOverlay(`Você fez ${sc}`, "Toque para jogar de novo");
    if (sc > 0) {
      const meuRun = runId;
      const r = await rewardGame(getActiveBaby(), "dino", sc);
      if (meuRun !== runId) return;   // o jogador já recomeçou: não mexe na tela
      registerCare();
      setOverlay(
        r.record ? `🏆 NOVO RECORDE: ${sc}!` : `Você fez ${sc}`,
        r.factor === 0 ? "Esta criança se cansou — troque de bebê ou volte depois"
                       : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus de recorde!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`
      );
    }
  }

  /* ------------------------- desenho ------------------------- */
  function drawDino() {
    const duck = ducking && dino.onGround;
    const h = duck ? 22 * s : dino.h;
    const w = duck ? 44 * s : dino.w;
    const cx = dino.x + w / 2;
    const pes = dino.y;
    const passo = dino.onGround ? Math.sin(dist / (7 * s)) * 1.5 * s : 0;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = `${h + 14 * s}px system-ui, sans-serif`;
    ctx.translate(cx, pes + 4 * s + passo);
    ctx.scale(-1, 1);
    ctx.fillText("🦖", 0, 0);
    ctx.restore();

    if (!duck) {
      desenharBebe(ctx, cx + 2, pes - h * 0.62 + passo, h * 0.85);
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawObstacle(o) {
    if (o.bird) {
      ctx.fillStyle = "#B57BA6";
      const up = Math.floor(o.flap) % 2 === 0;
      ctx.fillRect(o.x, o.y + (up ? 0 : 8 * s), o.w, 10 * s);
      ctx.fillRect(o.x + 8 * s, o.y + (up ? -8 * s : 14 * s), 18 * s, 6 * s);
    } else {
      ctx.fillStyle = "#6B9E7A";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillRect(o.x - 5 * s, o.y + o.h * 0.35, 5 * s, o.h * 0.3);
      ctx.fillRect(o.x + o.w, o.y + o.h * 0.25, 5 * s, o.h * 0.3);
    }
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#F2ECFA"); g.addColorStop(1, "#F9F4EE");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sol e nuvens de fundo
    ctx.fillStyle = "rgba(255,220,120,.5)";
    ctx.beginPath(); ctx.arc(W * 0.82, H * 0.14, 26 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    for (let i = 0; i < 3; i++) {
      const x = (i * (W / 2.4) - (dist * 0.15) % (W + 120) + W + 120) % (W + 120) - 60;
      ctx.beginPath(); ctx.ellipse(x, H * (0.2 + i * 0.08), 40 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = "#C9BFD4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 1);
    ctx.lineTo(W, GROUND + 1);
    ctx.stroke();

    ctx.fillStyle = "#DED5E6";
    for (let i = 0; i < 12; i++) {
      const x = (i * 90 * s - (dist % (90 * s)) + W) % (W + 90 * s);
      ctx.fillRect(x, GROUND + 8 * s, 22 * s, 3 * s);
    }

    obstacles.forEach(drawObstacle);
    drawDino();

    ctx.fillStyle = "#4A3F55";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(score()).padStart(5, "0"), W - 16, 40);
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("dino")}`, W - 16, 60);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("dino-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  /* ------------------------ controles ------------------------ */
  canvas.addEventListener("pointerdown", jump);
  document.getElementById("dino-overlay").addEventListener("pointerdown", jump);

  const duckBtn = document.getElementById("dino-duck");
  if (duckBtn) {
    const on = (e) => { e.preventDefault(); ducking = true; };
    const off = () => { ducking = false; };
    duckBtn.addEventListener("pointerdown", on);
    duckBtn.addEventListener("pointerup", off);
    duckBtn.addEventListener("pointerleave", off);
    duckBtn.addEventListener("pointercancel", off);
  }

  window.addEventListener("keydown", (e) => {
    if (!document.getElementById("screen-dino").classList.contains("active")) return;
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
    if (e.code === "ArrowDown") { e.preventDefault(); ducking = true; }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown") ducking = false;
  });

  view.onResize = reset;
  onScreenShown("screen-dino", reset);
  onScreenLeft("screen-dino", reset);
  reset();
  requestAnimationFrame(loop);
}
