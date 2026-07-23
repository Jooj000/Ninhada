/* =====================================================================
 * minigame.js  —  MINIGAME "FLAPPY BEBÊ" (canvas puro)
 * ---------------------------------------------------------------------
 * Toque/clique/espaço = pular. Passar por um cano = +1 ponto.
 * Ao perder, as moedas ganhas (= pontos) são somadas no banco e
 * aparecem nos dois celulares.
 *
 * TROCAR ARTE: onde está desenhado o círculo do "bird" e os retângulos
 * dos canos (funções drawBird / drawPipe), você pode desenhar um .png
 * via ctx.drawImage(imagem, ...). Deixei comentado onde plugar.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { desenharBebe } from "./baby-sprite.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { GAME_CONFIG } from "./config.js";

export function initMinigame() {
  const canvas = document.getElementById("mini-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Dimensões lógicas fixas; o CSS escala visualmente (responsivo).
  const W = canvas.width = 360;
  const H = canvas.height = 520;

  // ---- (opcional) carregar sprites .png ----
  // const birdImg = new Image(); birdImg.src = "assets/sprites/toys/rattle.png";

  const GRAVITY = 0.45, FLAP = -7.5, GAP = 150, PIPE_W = 60, SPEED = 2.4;

  let bird, pipes, score, running, dead;

  function reset() {
    bird = { x: 80, y: H / 2, vy: 0, r: 16 };
    pipes = [];
    score = 0;
    running = false;
    dead = false;
    spawnPipe();
    draw();
    setOverlay("Toque para começar", "");
  }

  function spawnPipe() {
    const top = 60 + Math.random() * (H - GAP - 160);
    pipes.push({ x: W + 20, top, passed: false });
  }

  function flap() {
    if (dead) { reset(); return; }
    if (!running) setOverlay("", "");     // <- some com o "toque para começar"
    running = true;
    bird.vy = FLAP;
  }

  function update() {
    if (!running || dead) return;

    bird.vy += GRAVITY;
    bird.y += bird.vy;

    // move canos
    for (const p of pipes) p.x -= SPEED;
    if (pipes.length && pipes[pipes.length - 1].x < W - 200) spawnPipe();
    pipes = pipes.filter((p) => p.x + PIPE_W > -20);

    // pontuação + colisão
    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < bird.x) { p.passed = true; score++; }
      const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
      const hit = bird.y - bird.r < p.top || bird.y + bird.r > p.top + GAP;
      if (inX && hit) return gameOver();
    }
    // chão / teto
    if (bird.y + bird.r > H || bird.y - bird.r < 0) return gameOver();
  }

  async function gameOver() {
    dead = true;
    running = false;
    setOverlay(`Você fez ${score}`, "Toque para jogar de novo");
    if (score > 0) {
      const r = await rewardGame(getActiveBaby(), "flappy", score);  // por tubo + recorde
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
    // O aviãozinho inclina conforme sobe/desce, e a criança aparece
    // da cabecinha para cima na cabine — o boneco COMPLETO equipado.
    const inclina = Math.max(-0.5, Math.min(0.7, bird.vy * 0.05));
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(inclina);

    // criança primeiro (fica ATRÁS do avião)
    desenharBebe(ctx, -2, -bird.r * 0.35, bird.r * 2.1, { soCabeca: true });

    // o foguete aponta para cima-direita; giro 45° para ele voar deitado
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
    // TROCAR ARTE AQUI por um .png de cano/nuvem, se a artista fizer.
    ctx.fillStyle = "#7EC8A0";
    ctx.fillRect(p.x, 0, PIPE_W, p.top);
    ctx.fillRect(p.x, p.top + GAP, PIPE_W, H - p.top - GAP);
  }

  function draw() {
    ctx.fillStyle = "#DCF1FF";
    ctx.fillRect(0, 0, W, H);
    pipes.forEach(drawPipe);
    drawBird();
    ctx.fillStyle = "#2b2b2b";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(score, W / 2, 48);
    // recorde da casa (compartilhado entre os dois)
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#5a6b7a";
    ctx.fillText(`🏆 recorde ${getRecord("flappy")}`, W / 2, 72);
  }

  function loop() { update(); draw(); requestAnimationFrame(loop); }

  function setOverlay(title, sub) {
    const ov = document.getElementById("mini-overlay");
    if (!ov) return;
    ov.style.display = (title || sub) ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  // controles
  canvas.addEventListener("pointerdown", flap);
  document.getElementById("mini-overlay").addEventListener("pointerdown", flap);
  window.addEventListener("keydown", (e) => {
    // só pula com espaço quando a tela do minigame está ativa
    if (e.code === "Space" && document.getElementById("screen-flappy").classList.contains("active")) {
      e.preventDefault(); flap();
    }
  });

  reset();
  loop();
}
