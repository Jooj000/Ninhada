/* =====================================================================
 * starpopper.js — STAR POPPER
 * ---------------------------------------------------------------------
 * Estoure as estrelinhas que sobem antes que escapem pelo topo.
 * Estrela pequena vale mais. Deixar escapar custa uma vida.
 * Cuidado com as bombas 💣 — não estoure!
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

export function initStarPopper() {
  const canvas = document.getElementById("sp-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 340);
  const H = (canvas.height = 440);

  let bolhas, pontos, vidas, spawn, rodando, morto, lastT = 0, tempo;

  function reset() {
    bolhas = []; pontos = 0; vidas = 3; spawn = 30; rodando = false; morto = false; tempo = 0;
    setOverlay("Toque para começar", "Estoure as estrelas ⭐ (evite 💣)");
    desenhar();
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  function soltar() {
    const bomba = Math.random() < 0.12 + Math.min(0.13, pontos / 260);
    const r = bomba ? 24 : 14 + Math.random() * 18;      // menor = mais difícil = vale mais
    bolhas.push({
      x: r + Math.random() * (W - 2 * r), y: H + r,
      r, bomba,
      vy: (bomba ? 1.5 : 1.1 + (24 - r) * 0.06) + tempo / 900,
      drift: Math.random() * 1.2 - 0.6, fase: Math.random() * 6,
    });
    spawn = Math.max(14, 40 - pontos * 0.25) + Math.random() * 18;
  }

  function update(dt) {
    if (!rodando || morto) return;
    tempo += dt;
    spawn -= dt;
    if (spawn <= 0) soltar();

    for (const b of bolhas) {
      b.y -= b.vy * dt;
      b.fase += 0.05 * dt;
      b.x += Math.sin(b.fase) * b.drift * dt;
      if (b.y + b.r < 0 && !b.fim) {
        b.fim = true;
        if (!b.bomba) { vidas--; if (vidas <= 0) fim(); }   // estrela escapou
      }
    }
    bolhas = bolhas.filter((b) => !b.fim && !b.pop);
  }

  function tocar(e) {
    comecar();
    if (!rodando || morto) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    for (let i = bolhas.length - 1; i >= 0; i--) {
      const b = bolhas[i];
      if (Math.hypot(x - b.x, y - b.y) <= b.r + 6) {
        b.pop = true;
        if (b.bomba) { vidas--; if (vidas <= 0) fim(); }
        else pontos += Math.max(1, Math.round((32 - b.r) / 5));   // menor vale mais
        return;
      }
    }
  }

  async function fim() {
    morto = true; rodando = false;
    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "starpopper", pontos);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${pontos}!` : `Você fez ${pontos}`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Fim!", "Toque para tentar de novo");
  }

  function desenhar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2A2740"); g.addColorStop(1, "#4A3F6B");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const b of bolhas) {
      ctx.font = `${b.r * 2}px system-ui, sans-serif`;
      ctx.fillText(b.bomba ? "💣" : "⭐", b.x, b.y);
    }

    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.font = "bold 16px system-ui, sans-serif"; ctx.fillStyle = "#fff";
    ctx.fillText(`${pontos}`, 12, 26);
    ctx.fillText("❤️".repeat(Math.max(0, vidas)), 12, 48);
    ctx.textAlign = "right"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#C9BFD4";
    ctx.fillText(`🏆 ${getRecord("starpopper")}`, W - 12, 26);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t; update(dt); desenhar();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("sp-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", tocar);
  document.getElementById("sp-overlay").addEventListener("pointerdown", comecar);

  reset();
  requestAnimationFrame(loop);
}
