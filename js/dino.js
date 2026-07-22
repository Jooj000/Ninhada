/* =====================================================================
 * dino.js — MINIGAME "DINO CORRIDA" (estilo dinossauro do Chrome)
 * ---------------------------------------------------------------------
 * Toque/clique/espaço = pular. Segurar embaixo (ou seta ↓) = abaixar.
 * A velocidade cresce com a distância. Pontos = distância percorrida.
 * Recorde é compartilhado entre os dois jogadores (Firebase).
 *
 * TROCAR ARTE: onde desenho os retângulos (drawDino/drawObstacle),
 * dá pra usar ctx.drawImage com um .png da artista. Deixei marcado.
 * ===================================================================== */

import { rewardGame, saveRecord, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { GAME_CONFIG } from "./config.js";

export function initDino() {
  const canvas = document.getElementById("dino-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const W = (canvas.width = 600);
  const H = (canvas.height = 200);
  const GROUND = H - 30;
  const GRAVITY = 0.62;
  const JUMP = -11.5;

  let dino, obstacles, speed, dist, running, dead, ducking, raf = 0, spawnIn = 0;
  let lastT = 0;   // p/ delta-time: o jogo roda igual em 60Hz, 90Hz ou 120Hz

  function reset() {
    dino = { x: 60, y: GROUND, vy: 0, w: 30, h: 40, onGround: true };
    obstacles = [];
    speed = 6;
    dist = 0;
    running = false;
    dead = false;
    ducking = false;
    spawnIn = 60;
    draw();
    setOverlay("Toque para começar", "Pule os cactos!");
  }

  const score = () => Math.floor(dist / 10);

  function jump() {
    if (dead) { reset(); return; }
    if (!running) setOverlay("", "");     // <- some com o "toque para começar"
    running = true;
    if (dino.onGround) { dino.vy = JUMP; dino.onGround = false; }
  }

  function spawn() {
    // 25% pássaro (obriga a abaixar), senão cacto de tamanho variável
    if (Math.random() < 0.25 && score() > 20) {
      obstacles.push({ x: W + 20, y: GROUND - 55, w: 34, h: 24, bird: true, flap: 0 });
    } else {
      const h = 28 + Math.random() * 26;
      const w = 14 + Math.random() * 16;
      obstacles.push({ x: W + 20, y: GROUND - h, w, h, bird: false });
    }
    spawnIn = Math.max(45, 95 - speed * 3) + Math.random() * 45;
  }

  function update(dt) {
    if (!running || dead) return;

    dist += speed * dt;
    speed = 6 + dist / 2600;                 // acelera devagar

    // física do dino (dt = 1 significa "um frame de 60Hz")
    dino.vy += GRAVITY * dt;
    dino.y += dino.vy * dt;
    if (dino.y >= GROUND) { dino.y = GROUND; dino.vy = 0; dino.onGround = true; }

    const dh = ducking && dino.onGround ? 22 : dino.h;   // altura ao abaixar
    const dw = ducking && dino.onGround ? 44 : dino.w;

    spawnIn -= dt;
    if (spawnIn <= 0) spawn();

    for (const o of obstacles) {
      o.x -= speed * dt;
      if (o.bird) o.flap += 0.2 * dt;
      // colisão AABB
      const dx = dino.x, dy = dino.y - dh;
      if (dx < o.x + o.w && dx + dw > o.x && dy < o.y + o.h && dy + dh > o.y) return gameOver();
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -10);
  }

  async function gameOver() {
    dead = true;
    running = false;
    const s = score();
    const rec = getRecord("dino");
    const novo = s > rec && s > 0;
    setOverlay(novo ? `🏆 NOVO RECORDE: ${s}!` : `Você fez ${s}`, "Toque para jogar de novo");
    if (s > 0) {
      const r = await rewardGame(getActiveBaby(), "dino", s);   // paga POR DISTÂNCIA
      await saveRecord("dino", s);
      registerCare();
      setOverlay(
        novo ? `🏆 NOVO RECORDE: ${s}!` : `Você fez ${s}`,
        r.factor === 0 ? "Esta criança se cansou — troque de bebê ou volte depois"
                       : `+${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`
      );
    }
  }

  /* ------------------------- desenho ------------------------- */
  function drawDino() {
    // TROCAR ARTE AQUI: ctx.drawImage(dinoImg, dino.x, dino.y - h, w, h);
    const duck = ducking && dino.onGround;
    const h = duck ? 22 : dino.h;
    const w = duck ? 44 : dino.w;
    ctx.fillStyle = "#7EC8A0";
    ctx.fillRect(dino.x, dino.y - h, w, h);
    ctx.fillStyle = "#4A3F55";                       // olhinho
    ctx.fillRect(dino.x + w - 10, dino.y - h + 6, 4, 4);
    if (!duck) {                                     // perninhas correndo
      const step = Math.floor(dist / 6) % 2 === 0;
      ctx.fillStyle = "#7EC8A0";
      ctx.fillRect(dino.x + 4, dino.y, 7, step ? 6 : 2);
      ctx.fillRect(dino.x + 18, dino.y, 7, step ? 2 : 6);
    }
  }

  function drawObstacle(o) {
    if (o.bird) {
      ctx.fillStyle = "#B57BA6";
      const up = Math.floor(o.flap) % 2 === 0;
      ctx.fillRect(o.x, o.y + (up ? 0 : 8), o.w, 10);   // corpo
      ctx.fillRect(o.x + 8, o.y + (up ? -8 : 14), 18, 6); // asa
    } else {
      // TROCAR ARTE AQUI por um .png de cacto/obstáculo
      ctx.fillStyle = "#6B9E7A";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillRect(o.x - 5, o.y + o.h * 0.35, 5, o.h * 0.3);
      ctx.fillRect(o.x + o.w, o.y + o.h * 0.25, 5, o.h * 0.3);
    }
  }

  function draw() {
    ctx.fillStyle = "#F7F3FA";
    ctx.fillRect(0, 0, W, H);

    // chão
    ctx.strokeStyle = "#C9BFD4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 1);
    ctx.lineTo(W, GROUND + 1);
    ctx.stroke();

    // marcas do chão (sensação de velocidade)
    ctx.fillStyle = "#DED5E6";
    for (let i = 0; i < 12; i++) {
      const x = (i * 90 - (dist % 90) + W) % (W + 90);
      ctx.fillRect(x, GROUND + 8, 22, 3);
    }

    obstacles.forEach(drawObstacle);
    drawDino();

    ctx.fillStyle = "#4A3F55";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(score()).padStart(5, "0"), W - 14, 28);
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("dino")}`, W - 14, 46);
  }

  function loop(t) {
    // dt normalizado: 1 = um frame de 60Hz. Limitado a 3 para não "teleportar"
    // se a aba ficar parada (evita atravessar obstáculo ao voltar).
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
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

  reset();
  requestAnimationFrame(loop);
}
