/* =====================================================================
 * skyjump.js — SKY JUMP (estilo Doodle Jump)
 * ---------------------------------------------------------------------
 * O bebê pula sozinho nas plataformas. Incline/arraste para os lados
 * (ou use as setas) para não cair. Pontos = altura alcançada.
 * Plataformas quebradiças somem depois de um pulo.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

export function initSkyJump() {
  const canvas = document.getElementById("sj-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 320);
  const H = (canvas.height = 460);

  const GRAV = 0.42, PULO = -11.4, LARG = 62, ALT = 12;
  let heroi, plats, altura, camera, rodando, morto, lastT = 0, alvoX = null;

  function novaPlat(y) {
    const quebra = altura > 400 && Math.random() < 0.18;
    return { x: 10 + Math.random() * (W - LARG - 20), y, quebra, usada: false };
  }

  function reset() {
    heroi = { x: W / 2 - 16, y: H - 120, vy: 0, vx: 0, w: 32, h: 32 };
    plats = [{ x: W / 2 - LARG / 2, y: H - 60, quebra: false, usada: false }];
    for (let i = 1; i < 9; i++) plats.push(novaPlat(H - 60 - i * 62));
    altura = 0; camera = 0; rodando = false; morto = false; alvoX = null;
    setOverlay("Toque para começar", "Arraste para os lados!");
    desenhar();
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; heroi.vy = PULO; setOverlay("", ""); }
  }

  function update(dt) {
    if (!rodando || morto) return;

    // horizontal: segue o dedo, com atravessamento nas bordas
    if (alvoX !== null) heroi.vx = (alvoX - (heroi.x + heroi.w / 2)) * 0.18;
    heroi.vx *= 0.88;
    heroi.x += heroi.vx * dt;
    if (heroi.x + heroi.w < 0) heroi.x = W;
    if (heroi.x > W) heroi.x = -heroi.w;

    heroi.vy += GRAV * dt;
    heroi.y += heroi.vy * dt;

    // colisão só descendo
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

    // câmera sobe junto
    if (heroi.y < H * 0.4) {
      const d = H * 0.4 - heroi.y;
      heroi.y += d; camera += d; altura += d;
      for (const p of plats) p.y += d;
    }

    // recicla plataformas que saíram por baixo
    plats = plats.filter((p) => p.y < H + 30);
    while (plats.length < 9) {
      const maisAlta = Math.min(...plats.map((p) => p.y));
      plats.push(novaPlat(maisAlta - (48 + Math.random() * 34)));
    }

    if (heroi.y > H + 40) fim();
  }

  const pontos = () => Math.floor(altura / 10);

  async function fim() {
    morto = true; rodando = false;
    const p = pontos();
    if (p > 0) {
      const r = await rewardGame(getActiveBaby(), "skyjump", p);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${p}!` : `Você subiu ${p}`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Caiu!", "Toque para tentar de novo");
  }

  function desenhar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#CFE8F7"); g.addColorStop(1, "#EAF4FB");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // nuvens de fundo (parallax simples)
    ctx.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 5; i++) {
      const y = ((i * 120 + camera * 0.25) % (H + 80)) - 40;
      ctx.beginPath(); ctx.ellipse(40 + i * 61, y, 34, 13, 0, 0, Math.PI * 2); ctx.fill();
    }

    for (const p of plats) {
      if (p.sumiu) continue;
      ctx.fillStyle = p.quebra ? "#E0A0A0" : "#7EC8A0";
      ctx.beginPath(); ctx.roundRect(p.x, p.y, LARG, ALT, 6); ctx.fill();
    }

    ctx.font = "30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👶", heroi.x + heroi.w / 2, heroi.y + heroi.h);

    ctx.textAlign = "left";
    ctx.font = "bold 16px system-ui, sans-serif"; ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${pontos()}`, 12, 26);
    ctx.textAlign = "right"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("skyjump")}`, W - 12, 26);
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

  const seguir = (e) => {
    const rect = canvas.getBoundingClientRect();
    alvoX = ((e.clientX - rect.left) / rect.width) * W;
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { comecar(); seguir(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.buttons) seguir(e); });
  canvas.addEventListener("pointerup", () => { alvoX = null; });
  document.getElementById("sj-overlay").addEventListener("pointerdown", comecar);

  window.addEventListener("keydown", (e) => {
    const tela = document.getElementById("screen-skyjump");
    if (!tela || !tela.classList.contains("active")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); alvoX = heroi.x - 40; }
    if (e.key === "ArrowRight") { e.preventDefault(); alvoX = heroi.x + 72; }
  });

  reset();
  requestAnimationFrame(loop);
}
