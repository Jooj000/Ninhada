/* =====================================================================
 * minigame.js  —  "FLAPPY BEBÊ" (tela cheia, resolução real)
 * ---------------------------------------------------------------------
 * Toque/clique/espaço = pular. Passar por um cano = 1 ponto.
 * Enquanto roda, ele É o jogo: canvas cobrindo a tela toda.
 * Sair da tela reseta a partida.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { desenharBebe } from "./baby-sprite.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

export function initMinigame() {
  const canvas = document.getElementById("mini-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-flappy");
  const ctx = view.ctx;

  let W = 360, H = 640, GAP = 170, PIPE_W = 64, SPEED = 2.4;
  const GRAVITY = 0.45, FLAP = -7.5;

  let bird, pipes, score, running, dead;

  function reset() {
    if (view.fit()) { W = view.w; H = view.h; }
    GAP = Math.max(150, Math.min(220, H * 0.27));
    PIPE_W = Math.max(56, W * 0.16);
    SPEED = W / 150;
    bird = { x: W * 0.24, y: H / 2, vy: 0, r: Math.max(16, H * 0.028) };
    pipes = [];
    score = 0;
    running = false;
    dead = false;
    spawnPipe();
    draw();
    setOverlay("Toque para começar", "");
  }

  function spawnPipe() {
    const top = 60 + Math.random() * (H - GAP - 200);
    pipes.push({ x: W + 20, top, passed: false });
  }

  function flap() {
    if (dead) { reset(); return; }
    if (!running) setOverlay("", "");
    running = true;
    bird.vy = FLAP;
  }

  function update() {
    if (!running || dead) return;

    bird.vy += GRAVITY;
    bird.y += bird.vy;

    for (const p of pipes) p.x -= SPEED;
    if (pipes.length && pipes[pipes.length - 1].x < W - Math.max(200, W * 0.55)) spawnPipe();
    pipes = pipes.filter((p) => p.x + PIPE_W > -20);

    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < bird.x) { p.passed = true; score++; }
      const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
      const hit = bird.y - bird.r < p.top || bird.y + bird.r > p.top + GAP;
      if (inX && hit) return gameOver();
    }
    if (bird.y + bird.r > H || bird.y - bird.r < 0) return gameOver();
  }

  async function gameOver() {
    dead = true;
    running = false;
    setOverlay(`Você fez ${score}`, "Toque para jogar de novo");
    if (score > 0) {
      const r = await rewardGame(getActiveBaby(), "flappy", score);
      registerCare();
      setOverlay(
        r.record ? `🏆 NOVO RECORDE: ${score}!` : `Você fez ${score}`,
        r.factor === 0 ? "Esta criança se cansou — troque de bebê ou volte depois"
                       : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus de recorde!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`
      );
    }
  }

  /* ---------------- desenho ---------------- */
  function drawBird() {
    const inclina = Math.max(-0.5, Math.min(0.7, bird.vy * 0.05));
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(inclina);
    desenharBebe(ctx, -2, -bird.r * 0.35, bird.r * 2.1, { soCabeca: true });
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.font = `${bird.r * 2.6}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚀", 0, bird.r * 0.15);
    ctx.restore();
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  function drawPipe(p) {
    ctx.fillStyle = "#7EC8A0";
    ctx.fillRect(p.x, 0, PIPE_W, p.top);
    ctx.fillRect(p.x, p.top + GAP, PIPE_W, H - p.top - GAP);
    ctx.fillStyle = "#6BB58F";
    ctx.fillRect(p.x - 4, p.top - 16, PIPE_W + 8, 16);
    ctx.fillRect(p.x - 4, p.top + GAP, PIPE_W + 8, 16);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#BFE3FA"); g.addColorStop(1, "#E7F5FF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    pipes.forEach(drawPipe);
    drawBird();
    ctx.fillStyle = "#2b2b2b";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(score, W / 2, 64);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#5a6b7a";
    ctx.fillText(`🏆 recorde ${getRecord("flappy")}`, W / 2, 88);
  }

  function loop() { update(); draw(); requestAnimationFrame(loop); }

  function setOverlay(title, sub) {
    const ov = document.getElementById("mini-overlay");
    if (!ov) return;
    ov.style.display = (title || sub) ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  canvas.addEventListener("pointerdown", flap);
  document.getElementById("mini-overlay").addEventListener("pointerdown", flap);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.getElementById("screen-flappy").classList.contains("active")) {
      e.preventDefault(); flap();
    }
  });

  view.onResize = reset;
  onScreenShown("screen-flappy", reset);   // entrar: ajusta e recomeça
  onScreenLeft("screen-flappy", reset);    // sair: RESETA a partida
  reset();
  loop();
}
