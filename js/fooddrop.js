/* =====================================================================
 * fooddrop.js — FOOD DROP (pegue a comida na cesta)
 * ---------------------------------------------------------------------
 * Arraste a cesta para pegar comidinha caindo. Comida boa = ponto;
 * pegar coisa ruim (🌶️/🦴) custa uma vida. Acelera com o tempo.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

const BONS = ["🍼", "🍌", "🍎", "🍪", "🥣", "🧀", "🍇"];
const RUINS = ["🌶️", "🦴", "🧦"];

export function initFoodDrop() {
  const canvas = document.getElementById("fd-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 340);
  const H = (canvas.height = 440);

  let cesta, itens, pontos, vidas, vel, spawn, rodando, morto, lastT = 0;
  const msg = document.getElementById("fd-msg");

  function reset() {
    cesta = { x: W / 2, w: 74 };
    itens = []; pontos = 0; vidas = 3; vel = 2.2; spawn = 50;
    rodando = false; morto = false;
    setOverlay("Toque para começar", "Arraste a cesta!");
    desenhar();
  }

  function começar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  function soltar() {
    const ruim = Math.random() < 0.18 + Math.min(0.12, pontos / 300);
    const lista = ruim ? RUINS : BONS;
    itens.push({
      x: 24 + Math.random() * (W - 48), y: -20,
      e: lista[Math.floor(Math.random() * lista.length)], ruim,
    });
    spawn = Math.max(18, 52 - pontos * 0.4) + Math.random() * 20;
  }

  function update(dt) {
    if (!rodando || morto) return;
    vel = 2.2 + pontos * 0.035;
    spawn -= dt;
    if (spawn <= 0) soltar();

    for (const it of itens) {
      it.y += vel * dt;
      const pegou = it.y > H - 58 && it.y < H - 18 &&
                    Math.abs(it.x - cesta.x) < cesta.w / 2 + 10;
      if (pegou && !it.fim) {
        it.fim = true;
        if (it.ruim) { vidas--; if (vidas <= 0) fim(); }
        else pontos++;
      }
      if (it.y > H + 20 && !it.fim) it.fim = true;
    }
    itens = itens.filter((i) => !i.fim && i.y < H + 30);
  }

  async function fim() {
    morto = true; rodando = false;
    const rec = getRecord("fooddrop");
    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "fooddrop", pontos);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${pontos}!` : `Você pegou ${pontos}`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
                       : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Fim!", "Toque para tentar de novo");
  }

  function desenhar() {
    ctx.fillStyle = "#FBF4F8"; ctx.fillRect(0, 0, W, H);

    // chão
    ctx.fillStyle = "#EFE3EE"; ctx.fillRect(0, H - 22, W, 22);

    ctx.font = "26px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const it of itens) ctx.fillText(it.e, it.x, it.y);

    // cesta
    ctx.fillStyle = "#C9A06B";
    ctx.beginPath();
    ctx.roundRect(cesta.x - cesta.w / 2, H - 52, cesta.w, 32, 8);
    ctx.fill();
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("🧺", cesta.x, H - 30);

    // hud
    ctx.textAlign = "left";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${pontos}`, 12, 26);
    ctx.fillText("❤️".repeat(Math.max(0, vidas)), 12, 48);
    ctx.textAlign = "right";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("fooddrop")}`, W - 12, 26);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t;
    update(dt); desenhar();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("fd-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  /* controles: arrastar a cesta */
  const mover = (e) => {
    const r = canvas.getBoundingClientRect();
    cesta.x = Math.max(cesta.w / 2, Math.min(W - cesta.w / 2,
      ((e.clientX - r.left) / r.width) * W));
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { começar(); mover(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.buttons) mover(e); });
  document.getElementById("fd-overlay").addEventListener("pointerdown", começar);

  reset();
  requestAnimationFrame(loop);
}
