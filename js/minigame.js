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
import { BALANCE } from "./config.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

export function initMinigame() {
  /* Conta as partidas. Uma recompensa que chega DEPOIS de o jogador
   * já ter recomeçado pertence a outra partida e deve ser ignorada —
   * era isso que fazia a tela de morte reaparecer por cima do jogo. */
  let runId = 0;
  const canvas = document.getElementById("mini-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-flappy");
  const ctx = view.ctx;

  /* PROPORÇÕES DO ORIGINAL (canvas 360×520). Tudo que é vertical escala
   * por sy = H/520 e tudo que é horizontal por sx = W/360. Assim o pulo
   * ocupa a MESMA fração da tela em qualquer tamanho — antes a física
   * era absoluta e, no PC, o mapa ficava gigante com pulinhos minúsculos. */
  const REF_W = 360, REF_H = 520;
  const GRAVITY_REF = 0.45, FLAP_REF = -7.5;
  const GAP_REF = 170, PIPE_W_REF = 64, SPEED_REF = 2.4;
  const RAIO_REF = 18, VAO_CANOS_REF = 220, MARGEM_REF = 60, FUNDO_REF = 200;

  let W = 360, H = 640, sx = 1, sy = 1;
  let GAP = 170, PIPE_W = 64, SPEED = 2.4, GRAVITY = 0.45, FLAP = -7.5;
  let VAO_CANOS = 220, MARGEM = 60, FUNDO = 200;

  let bird, pipes, score, running, dead;
  let proximoVao = 170;          // distância até o próximo cano (sorteada)

  function reset() {
    runId++;                      // nova partida: invalida recompensas pendentes
    if (view.fit()) { W = view.w; H = view.h; }
    sx = W / REF_W; sy = H / REF_H;

    GAP     = GAP_REF * sy;          // abertura: mesma fração da altura
    PIPE_W  = PIPE_W_REF * sx;
    SPEED   = SPEED_REF * sx;        // canos cruzam a tela no mesmo tempo
    GRAVITY = GRAVITY_REF * sy;      // gravidade e impulso escalam JUNTOS,
    FLAP    = FLAP_REF * sy;         // então a altura do pulo é proporcional
    // distância entre canos: sorteada a cada cano, entre 0,8x e 1,0x o VÃO
    VAO_CANOS = GAP;
    MARGEM  = MARGEM_REF * sy;
    FUNDO   = FUNDO_REF * sy;

    bird = { x: W * 0.24, y: H / 2, vy: 0, r: RAIO_REF * Math.min(sx, sy) };
    pipes = [];
    score = 0;
    running = false;
    dead = false;
    spawnPipe();
    draw();
    setOverlay("Toque para começar", "");
  }

  function spawnPipe() {
    const top = MARGEM + Math.random() * Math.max(20, H - GAP - FUNDO);
    /* O espaço até o PRÓXIMO cano é uma fração da ALTURA DO VÃO:
     * entre 0,8x e 1,0x. Assim a dificuldade horizontal acompanha a
     * vertical em qualquer tela. */
    const f = BALANCE.flappy || { espacoMin: 0.8, espacoMax: 1.0 };
    const fator = f.espacoMin + Math.random() * (f.espacoMax - f.espacoMin);
    proximoVao = GAP * fator;
    pipes.push({ x: W + 20, top, passed: false });
  }

  function flap() {
    if (dead) { reset(); return; }
    setOverlay("", "");           // sempre limpa: nunca deixa a tela de morte presa
    running = true;
    bird.vy = FLAP;
  }

  function update() {
    if (!running || dead) return;

    bird.vy += GRAVITY;
    bird.y += bird.vy;

    for (const p of pipes) p.x -= SPEED;
    if (pipes.length && pipes[pipes.length - 1].x < W - proximoVao) spawnPipe();
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
      const meuRun = runId;
      const r = await rewardGame(getActiveBaby(), "flappy", score);
      if (meuRun !== runId) return;   // o jogador já recomeçou: não mexe na tela
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
    const tampa = 16 * sy, borda = 4 * sx;
    ctx.fillRect(p.x - borda, p.top - tampa, PIPE_W + borda * 2, tampa);
    ctx.fillRect(p.x - borda, p.top + GAP, PIPE_W + borda * 2, tampa);
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
