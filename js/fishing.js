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
import { getWeather } from "./weather.js";

/* Cada peixe tem `clima`: em qual tempo ele aparece (vazio = sempre).
 * Velocidade e nervosismo saem do VALOR: quanto mais raro, mais ligeiro. */
const PEIXES = [
  { nome: "Lambari",   emoji: "🐟", pontos: 1,  clima: [] },
  { nome: "Tilápia",   emoji: "🐠", pontos: 2,  clima: [] },
  { nome: "Carpa",     emoji: "🎏", pontos: 3,  clima: ["clear", "clouds"] },
  { nome: "Dourado",   emoji: "🐡", pontos: 5,  clima: ["clear"] },
  { nome: "Truta",     emoji: "🐟", pontos: 6,  clima: ["cold"] },
  { nome: "Pintado",   emoji: "🦈", pontos: 8,  clima: ["rain"] },
  { nome: "Bagre",     emoji: "🐙", pontos: 9,  clima: ["rain", "storm"] },
  { nome: "Pirarucu",  emoji: "🐋", pontos: 14, clima: ["storm"] },
];

/* Ligeireza derivada do valor: peixe de 1 ponto é lento; de 14, muito rápido. */
function perfil(p) {
  return {
    ...p,
    vel: 0.8 + p.pontos * 0.16,          // 0.96 -> 3.0
    erratico: 0.015 + p.pontos * 0.007,  // 0.02 -> 0.11
    fuga: 0.0034 + p.pontos * 0.00035,   // raro escapa mais rápido
  };
}

/* Sorteia respeitando o clima atual: peixe do clima certo tem peso alto;
 * peixes "de qualquer tempo" sempre podem vir. */
function sortearPeixe(total) {
  const w = getWeather();
  const clima = w ? w.main : "clear";
  const cand = [];
  for (const p of PEIXES) {
    const combina = p.clima.length === 0 || p.clima.includes(clima);
    if (!combina) continue;
    // sorte melhora conforme a pescaria rende, mas peixe raro segue raro
    const peso = Math.max(0.4, (10 - p.pontos) + total / 8);
    cand.push({ p, peso });
  }
  const soma = cand.reduce((s, c) => s + c.peso, 0);
  let r = Math.random() * soma;
  for (const c of cand) { r -= c.peso; if (r <= 0) return perfil(c.p); }
  return perfil(PEIXES[0]);
}

export function initFishing() {
  const canvas = document.getElementById("fish-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 220);
  const H = (canvas.height = 420);

  const BAR_H = 92;            // altura da "rede" verde
  let barY, barV, fishY, fishV, fishTarget, progresso, peixe, estado, total, lastT = 0;
  let esperaAte = 0, fisgarAte = 0;
  let segurando = false;

  const msg = document.getElementById("fish-msg");
  const info = document.getElementById("fish-info");

  /* 1) joga a linha e ESPERA o peixe morder (tempo aleatório) */
  function lancar() {
    estado = "esperando";
    peixe = sortearPeixe(total);
    esperaAte = performance.now() + 1400 + Math.random() * 4200;
    const w = getWeather();
    info.textContent = w ? `Tempo: ${w.desc} — atrai peixes diferentes` : "";
    msg.textContent = "Aguarde a fisgada…";
  }

  /* 2) o peixe mordeu: janela curta pra fisgar */
  function morder(agora) {
    estado = "mordendo";
    fisgarAte = agora + 1100;
    msg.textContent = "❗ FISGUE AGORA!";
    if (navigator.vibrate) navigator.vibrate(60);
  }

  /* 3) fisgou: começa a luta na rede */
  function começarLuta() {
    barY = H - BAR_H - 10; barV = 0;
    fishY = H / 2; fishV = 0; fishTarget = H / 2;
    progresso = 0.35;
    estado = "pescando";
    info.textContent = `${peixe.emoji} ${peixe.nome} — vale ${peixe.pontos} ponto(s)`;
    msg.textContent = "Segure para subir a rede!";
  }

  function perdeuFisgada() {
    estado = "escapou";
    msg.textContent = `${peixe.emoji} soltou a isca… (demorou a fisgar)`;
    document.getElementById("fish-next").hidden = false;
    document.getElementById("fish-stop").hidden = false;
  }

  function update(dt) {
    const agora = performance.now();
    if (estado === "esperando") { if (agora >= esperaAte) morder(agora); return; }
    if (estado === "mordendo")  { if (agora >= fisgarAte) perdeuFisgada(); return; }
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
    progresso += (dentro ? 0.0055 : -(peixe.fuga || 0.0042)) * dt;
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

    if (estado === "pescando") {
      // trilho
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(W * 0.28, 6, W * 0.44, H - 12);
      // rede
      ctx.fillStyle = "rgba(126,200,160,.85)";
      ctx.fillRect(W * 0.28, barY, W * 0.44, BAR_H);
    }

    // peixe (só aparece durante a luta; antes disso fica escondido na água)
    ctx.textAlign = "center";
    if (estado === "pescando") {
      ctx.font = "26px system-ui, sans-serif";
      ctx.fillText(peixe ? peixe.emoji : "🐟", W / 2, fishY + 9);
    } else if (estado === "esperando") {
      ctx.font = "30px system-ui, sans-serif";
      ctx.fillText("🎣", W / 2, H / 2);
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.9)";
      const p = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
      ctx.fillText(`aguardando${p}`, W / 2, H / 2 + 34);
    } else if (estado === "mordendo") {
      ctx.font = "bold 54px system-ui, sans-serif";
      ctx.fillStyle = "#FFE55C";
      ctx.fillText("❗", W / 2, H / 2 + 12);
    }

    if (estado === "pescando") {
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.fillRect(W - 20, 6, 12, H - 12);
      const h = (H - 12) * progresso;
      ctx.fillStyle = progresso > 0.6 ? "#7EC8A0" : progresso > 0.3 ? "#FFD36B" : "#E38C7A";
      ctx.fillRect(W - 20, H - 6 - h, 12, h);
    }
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;   // independente de Hz
    lastT = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* controles: segurar */
  const seg = (e) => {
    e.preventDefault();
    if (estado === "mordendo") { começarLuta(); return; }   // fisgada!
    segurando = true;
  };
  const solta = () => { segurando = false; };
  canvas.addEventListener("pointerdown", seg);
  window.addEventListener("pointerup", solta);
  canvas.addEventListener("pointercancel", solta);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.getElementById("screen-fishing").classList.contains("active")) {
      e.preventDefault();
      if (estado === "mordendo") { começarLuta(); return; }
      segurando = true;
    }
  });
  window.addEventListener("keyup", (e) => { if (e.code === "Space") segurando = false; });

  document.getElementById("fish-next").onclick = () => {
    document.getElementById("fish-next").hidden = true;
    document.getElementById("fish-stop").hidden = true;
    lancar();
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
    lancar();
  };

  total = 0;
  peixe = PEIXES[0];
  barY = H - BAR_H - 10; fishY = H / 2; progresso = 0.35; estado = "fim";
  info.textContent = "Segure para subir a rede e mantenha o peixe dentro.";
  msg.textContent = "";
  requestAnimationFrame(loop);
}
