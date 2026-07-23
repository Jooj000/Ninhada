/* =====================================================================
 * fooddrop.js — FOOD DROP em TELA CHEIA (pegue a comida na cesta)
 * ---------------------------------------------------------------------
 * Arraste a cesta. REGRAS NOVAS:
 *   - TODO emoji de comida é comestível (até 🌶️ pimenta é comida!);
 *     o que machuca são OBJETOS (🧦 meia, 🪨 pedra, 🧴 shampoo…).
 *   - Deixar uma comida BOA cair no chão também custa uma vida —
 *     comida não se joga fora!
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

/* Comida é comida — qualquer uma alimenta. */
const BONS = [
  "🍼", "🍌", "🍎", "🍪", "🥣", "🧀", "🍇", "🍓", "🍉", "🍊",
  "🍐", "🍑", "🥭", "🍍", "🥕", "🌽", "🥦", "🍞", "🥐", "🥞",
  "🍚", "🍝", "🍕", "🍦", "🍰", "🧁", "🍩", "🥛", "🍯", "🌶️",
];
/* Objeto não se come. */
const RUINS = ["🧦", "🧸", "📎", "🪨", "👟", "🧴", "🪥", "⚽", "🧽", "🔑", "🧲", "✏️"];

export function initFoodDrop() {
  const canvas = document.getElementById("fd-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-fooddrop");
  const ctx = view.ctx;

  let W = 360, H = 640, sy = 1, CHAO = 24, CESTA_Y = 58;
  let cesta, itens, pontos, vidas, vel, spawn, rodando, morto, lastT = 0;
  let avisos;   // "-1 ❤️" flutuando onde a comida caiu

  function medidas() {
    if (view.fit()) { W = view.w; H = view.h; }
    sy = Math.max(1, H / 440);            // tela alta = queda proporcional
    CHAO = Math.max(22, H * 0.045);
    CESTA_Y = CHAO + 36;
  }

  function reset() {
    medidas();
    cesta = { x: W / 2, w: Math.max(70, Math.min(110, W * 0.22)) };
    itens = []; avisos = []; pontos = 0; vidas = 3; vel = 2.2 * sy; spawn = 50;
    rodando = false; morto = false; lastT = 0;
    setOverlay("Toque para começar", "Pegue TODA comida — objeto não se come!");
    desenhar();
  }

  function começar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  function soltar() {
    const ruim = Math.random() < 0.22 + Math.min(0.14, pontos / 260);
    const lista = ruim ? RUINS : BONS;
    itens.push({
      x: 28 + Math.random() * (W - 56), y: -24,
      e: lista[Math.floor(Math.random() * lista.length)], ruim,
    });
    spawn = Math.max(16, 50 - pontos * 0.4) + Math.random() * 20;
  }

  function perdeVida(x, y, motivo) {
    vidas--;
    avisos.push({ x, y, t: 60, txt: motivo });
    if (navigator.vibrate) navigator.vibrate(50);
    if (vidas <= 0) fim();
  }

  function update(dt) {
    if (!rodando || morto) return;
    vel = (2.2 + pontos * 0.032) * sy;
    spawn -= dt;
    if (spawn <= 0) soltar();

    const topoCesta = H - CESTA_Y - 6;
    for (const it of itens) {
      it.y += vel * dt;
      const pegou = it.y > topoCesta - 26 && it.y < H - CHAO - 6 &&
                    Math.abs(it.x - cesta.x) < cesta.w / 2 + 10;
      if (pegou && !it.fim) {
        it.fim = true;
        if (it.ruim) perdeVida(it.x, it.y, "eca!");
        else pontos++;
      }
      /* comida boa que chega ao chão sem ser pega = vida perdida */
      if (!it.fim && it.y > H - CHAO + 4) {
        it.fim = true;
        if (!it.ruim) perdeVida(it.x, H - CHAO - 8, "caiu!");
        /* objeto no chão: sem problema, era pra deixar cair mesmo */
      }
    }
    itens = itens.filter((i) => !i.fim && i.y < H + 30);
    for (const a of avisos) a.t -= dt;
    avisos = avisos.filter((a) => a.t > 0);
  }

  async function fim() {
    morto = true; rodando = false;
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
    ctx.fillStyle = "#EFE3EE"; ctx.fillRect(0, H - CHAO, W, CHAO);

    ctx.font = "30px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const it of itens) ctx.fillText(it.e, it.x, it.y);

    // cesta
    ctx.fillStyle = "#C9A06B";
    ctx.beginPath();
    ctx.roundRect(cesta.x - cesta.w / 2, H - CESTA_Y, cesta.w, 34, 9);
    ctx.fill();
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText("🧺", cesta.x, H - CESTA_Y + 24);

    // avisos "-1 ❤️"
    ctx.font = "bold 15px system-ui, sans-serif";
    for (const a of avisos) {
      ctx.globalAlpha = Math.min(1, a.t / 30);
      ctx.fillStyle = "#D46A6A";
      ctx.fillText(`💔 ${a.txt}`, a.x, a.y - (60 - a.t) * 0.5);
      ctx.globalAlpha = 1;
    }

    // hud
    ctx.textAlign = "left";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${pontos}`, 14, 32);
    ctx.fillText("❤️".repeat(Math.max(0, vidas)), 14, 56);
    ctx.textAlign = "right";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("fooddrop")}`, W - 14, 32);
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

  const mover = (e) => {
    const r = canvas.getBoundingClientRect();
    cesta.x = Math.max(cesta.w / 2, Math.min(W - cesta.w / 2,
      ((e.clientX - r.left) / r.width) * W));
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { começar(); mover(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.buttons) mover(e); });
  document.getElementById("fd-overlay").addEventListener("pointerdown", começar);

  view.onResize = reset;
  onScreenShown("screen-fooddrop", reset);
  onScreenLeft("screen-fooddrop", reset);
  reset();
  requestAnimationFrame(loop);
}
