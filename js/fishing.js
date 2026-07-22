/* =====================================================================
 * fishing.js — PESCARIA (estilo Stardew Valley)
 * ---------------------------------------------------------------------
 * Segure a tela para SUBIR a barra verde; solte para descer. Mantenha o
 * peixe dentro da barra para encher o progresso. Se o progresso zerar,
 * o peixe escapa. Cada peixe fisgado vale pontos (peixe raro vale mais).
 * ===================================================================== */

import { rewardGame, saveRecord, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

const PEIXES = [
  { nome: "Lambari",   emoji: "🐟", pontos: 1, vel: 0.9, erratico: 0.02 },
  { nome: "Tilápia",   emoji: "🐠", pontos: 2, vel: 1.2, erratico: 0.03 },
  { nome: "Dourado",   emoji: "🐡", pontos: 4, vel: 1.7, erratico: 0.05 },
  { nome: "Pintado",   emoji: "🦈", pontos: 7, vel: 2.2, erratico: 0.07 },
  { nome: "Pirarucu",  emoji: "🐋", pontos: 12, vel: 2.8, erratico: 0.09 },
];

export function initFishing() {
  const canvas = document.getElementById("fish-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 220);
  const H = (canvas.height = 420);

  const BAR_H = 92;            // altura da "rede" verde
  let barY, barV, fishY, fishV, fishTarget, progresso, peixe, estado, total, lastT = 0;
  let segurando = false;

  const msg = document.getElementById("fish-msg");
  const info = document.getElementById("fish-info");

  function novoPeixe() {
    // peixes raros aparecem mais conforme você pesca bem
    const chance = Math.random() * (1 + total / 12);
    peixe = chance > 2.6 ? PEIXES[4] : chance > 1.8 ? PEIXES[3]
          : chance > 1.1 ? PEIXES[2] : chance > 0.55 ? PEIXES[1] : PEIXES[0];
    barY = H - BAR_H - 10; barV = 0;
    fishY = H / 2; fishV = 0; fishTarget = H / 2;
    progresso = 0.35;
    estado = "pescando";
    info.textContent = `${peixe.emoji} ${peixe.nome} — vale ${peixe.pontos} ponto(s)`;
    msg.textContent = "Segure para subir a rede!";
  }

  function update(dt) {
    if (estado !== "pescando") return;

    // rede: sobe segurando, cai soltando
    barV += (segurando ? -0.55 : 0.42) * dt;
    barV *= 0.92;
    barY += barV * dt;
    if (barY < 0) { barY = 0; barV = 0; }
    if (barY > H - BAR_H) { barY = H - BAR_H; barV = 0; }

    // peixe: nada até um alvo e às vezes muda de ideia (mais nervoso = raro)
    if (Math.random() < peixe.erratico * dt) fishTarget = 20 + Math.random() * (H - 40);
    const dir = Math.sign(fishTarget - fishY);
    fishV += dir * 0.14 * peixe.vel * dt;
    fishV *= 0.9;
    fishY += fishV * dt;
    if (fishY < 12) { fishY = 12; fishV = 0; fishTarget = H / 2; }
    if (fishY > H - 12) { fishY = H - 12; fishV = 0; fishTarget = H / 2; }

    // dentro da rede?
    const dentro = fishY > barY && fishY < barY + BAR_H;
    progresso += (dentro ? 0.0055 : -0.0042) * dt * 60 / 60;
    progresso = Math.max(0, Math.min(1, progresso));

    if (progresso >= 1) fisgou();
    else if (progresso <= 0) escapou();
  }

  function fisgou() {
    estado = "pegou";
    total += peixe.pontos;
    msg.textContent = `Pegou! ${peixe.emoji} ${peixe.nome} (+${peixe.pontos})`;
    document.getElementById("fish-next").hidden = false;
    document.getElementById("fish-stop").hidden = false;
  }

  function escapou() {
    estado = "escapou";
    msg.textContent = `${peixe.emoji} escapou…`;
    document.getElementById("fish-next").hidden = false;
    document.getElementById("fish-stop").hidden = false;
  }

  function draw() {
    // água
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#BFE3F5"); grad.addColorStop(1, "#5C9BC4");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // trilho
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(W * 0.28, 6, W * 0.44, H - 12);

    // rede
    ctx.fillStyle = "rgba(126,200,160,.85)";
    ctx.fillRect(W * 0.28, barY, W * 0.44, BAR_H);

    // peixe
    ctx.font = "26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(peixe ? peixe.emoji : "🐟", W / 2, fishY + 9);

    // barra de progresso lateral
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillRect(W - 20, 6, 12, H - 12);
    const h = (H - 12) * progresso;
    ctx.fillStyle = progresso > 0.6 ? "#7EC8A0" : progresso > 0.3 ? "#FFD36B" : "#E38C7A";
    ctx.fillRect(W - 20, H - 6 - h, 12, h);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;   // independente de Hz
    lastT = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* controles: segurar */
  const seg = (e) => { e.preventDefault(); segurando = true; };
  const solta = () => { segurando = false; };
  canvas.addEventListener("pointerdown", seg);
  window.addEventListener("pointerup", solta);
  canvas.addEventListener("pointercancel", solta);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.getElementById("screen-fishing").classList.contains("active")) {
      e.preventDefault(); segurando = true;
    }
  });
  window.addEventListener("keyup", (e) => { if (e.code === "Space") segurando = false; });

  document.getElementById("fish-next").onclick = () => {
    document.getElementById("fish-next").hidden = true;
    document.getElementById("fish-stop").hidden = true;
    novoPeixe();
  };

  document.getElementById("fish-stop").onclick = async () => {
    document.getElementById("fish-next").hidden = true;
    document.getElementById("fish-stop").hidden = true;
    estado = "fim";
    if (total > 0) {
      const rec = getRecord("fishing");
      const r = await rewardGame(getActiveBaby(), "fishing", total);
      await saveRecord("fishing", total);
      registerCare();
      msg.textContent = r.factor === 0
        ? `Pescaria encerrada (${total} pts) — a criança se cansou.`
        : `${total > rec ? "🏆 NOVO RECORDE! " : ""}${total} pts · +${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
    } else {
      msg.textContent = "Nenhum peixe desta vez.";
    }
    info.textContent = "Toque em “Jogar a linha” para recomeçar.";
    total = 0;
    document.getElementById("fish-cast").hidden = false;
  };

  document.getElementById("fish-cast").onclick = () => {
    document.getElementById("fish-cast").hidden = true;
    total = 0;
    novoPeixe();
  };

  total = 0;
  peixe = PEIXES[0];
  barY = H - BAR_H - 10; fishY = H / 2; progresso = 0.35; estado = "fim";
  info.textContent = "Segure para subir a rede e mantenha o peixe dentro.";
  msg.textContent = "";
  requestAnimationFrame(loop);
}
