/* =====================================================================
 * hilldrive.js — HILL DRIVE (carrinho pelas colinas)
 * ---------------------------------------------------------------------
 * Regras do original (fonte: wikis do Pou): jogo lateral onde você
 * toca no lado DIREITO da tela para acelerar e no ESQUERDO para frear
 * (ré). O objetivo é ir o mais longe possível.
 *
 * O terreno é gerado por soma de senoides — determinístico pela posição,
 * então nunca "acaba" e não precisa guardar nada.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

export function initHillDrive() {
  const canvas = document.getElementById("hd-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 420), H = (canvas.height = 260);

  const GRAV = 0.42;
  const BASE = H * 0.62;

  let carro, cam, rodando, morto, lastT = 0, moedas, pegas;
  let acelera = 0;            // +1 acelerando, -1 freando/ré

  /* Altura do terreno em qualquer x (soma de ondas: colinas suaves). */
  function solo(x) {
    return BASE
      + Math.sin(x * 0.006) * 42
      + Math.sin(x * 0.017 + 1.3) * 18
      + Math.sin(x * 0.041 + 2.7) * 7;
  }
  /* Inclinação do terreno (derivada aproximada). */
  function inclinacao(x) {
    return Math.atan2(solo(x + 6) - solo(x - 6), 12);
  }

  function reset() {
    carro = { x: 60, y: solo(60) - 20, vx: 0, vy: 0, ang: 0, noChao: true };
    cam = 0; rodando = false; morto = false; acelera = 0;
    moedas = []; pegas = 0;
    for (let i = 1; i < 60; i++) semearMoeda(i * 260 + Math.random() * 120);
    setOverlay("Toque para começar", "Direita acelera · esquerda freia");
    desenhar();
  }

  function semearMoeda(x) {
    moedas.push({ x, y: solo(x) - 34, pego: false });
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  const distancia = () => Math.max(0, Math.floor(carro.x / 10));

  function update(dt) {
    if (!rodando || morto) return;

    const chao = solo(carro.x);
    const inc = inclinacao(carro.x);
    carro.noChao = carro.y >= chao - 21;

    if (carro.noChao) {
      // motor empurra na direção da ladeira; a gravidade puxa na descida
      carro.vx += (acelera * 0.26 - Math.sin(inc) * 0.42) * dt;
      carro.vx *= Math.pow(0.985, dt);                  // atrito
      carro.ang += (inc - carro.ang) * 0.25 * dt;       // acompanha o relevo
      carro.y = chao - 20;
      carro.vy = 0;
      if (carro.vx < -3) carro.vx = -3;
      if (carro.vx > 9) carro.vx = 9;
    } else {
      carro.vy += GRAV * dt;
      carro.y += carro.vy * dt;
      carro.ang += acelera * 0.035 * dt;                // gira no ar
      if (carro.y >= chao - 20) {
        // aterrissou: se estiver muito de lado, capota
        const diff = Math.abs(((carro.ang - inc) + Math.PI) % (Math.PI * 2) - Math.PI);
        if (diff > 1.15) return fim("Capotou!");
        carro.y = chao - 20; carro.vy = 0;
      }
    }

    carro.x += carro.vx * dt;
    if (carro.x < 0) carro.x = 0;
    // saltou de uma rampa?
    if (carro.noChao && carro.vx > 3 && solo(carro.x + 14) > chao + 6) {
      carro.vy = -Math.min(9, carro.vx * 0.9);
      carro.y -= 2;
    }

    cam = carro.x - 110;

    for (const m of moedas) {
      if (m.pego) continue;
      if (Math.abs(m.x - carro.x) < 22 && Math.abs(m.y - carro.y) < 34) { m.pego = true; pegas++; }
    }
    while (moedas.length && moedas[moedas.length - 1].x < carro.x + 3000)
      semearMoeda(moedas[moedas.length - 1].x + 200 + Math.random() * 180);

    // parou de vez numa subida = fim (não dá pra continuar)
    if (carro.noChao && Math.abs(carro.vx) < 0.06 && acelera >= 0 && distancia() > 3) {
      carro.parado = (carro.parado || 0) + dt;
      if (carro.parado > 150) return fim("O carrinho empacou!");
    } else carro.parado = 0;
  }

  async function fim(motivo) {
    morto = true; rodando = false;
    const pontos = distancia() + pegas * 10;
    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "hilldrive", pontos, distancia());
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${distancia()} m!` : `${motivo} ${distancia()} m · 🪙${pegas}`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay(motivo, "Toque para tentar de novo");
  }

  function desenhar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#CFE8F7"); g.addColorStop(1, "#EFE6D8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // morros de fundo (parallax)
    ctx.fillStyle = "rgba(150,180,150,.45)";
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const wx = (cam * 0.4) + x;
      ctx.lineTo(x, BASE + 30 + Math.sin(wx * 0.004) * 34);
    }
    ctx.lineTo(W, H); ctx.fill();

    // terreno
    ctx.fillStyle = "#7EA05B";
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, solo(cam + x));
    ctx.lineTo(W, H); ctx.fill();
    ctx.strokeStyle = "#5F8043"; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = solo(cam + x);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // moedas
    ctx.font = "18px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const m of moedas) {
      if (m.pego) continue;
      const x = m.x - cam;
      if (x < -20 || x > W + 20) continue;
      ctx.fillText("🪙", x, m.y);
    }

    // carrinho
    ctx.save();
    ctx.translate(carro.x - cam, carro.y);
    ctx.rotate(carro.ang);
    ctx.font = "30px system-ui, sans-serif";
    ctx.fillText("🚙", 0, 0);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("👶", -2, -14);
    ctx.restore();
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left"; ctx.font = "bold 16px system-ui, sans-serif"; ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${distancia()} m · 🪙 ${pegas}`, 12, 26);
    ctx.textAlign = "right"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("hilldrive")}`, W - 12, 26);

    // pedais
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = acelera > 0 ? "#6BB77B" : "#000";
    ctx.fillRect(W / 2, H - 46, W / 2, 46);
    ctx.fillStyle = acelera < 0 ? "#E05A5A" : "#000";
    ctx.fillRect(0, H - 46, W / 2, 46);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#4A3F55"; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("◀ FREIO", W * 0.25, H - 18);
    ctx.fillText("ACELERAR ▶", W * 0.75, H - 18);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t; update(dt); desenhar();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("hd-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  const lado = (e) => {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) > 0.5 ? 1 : -1;
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { comecar(); acelera = lado(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.buttons || e.pressure > 0) acelera = lado(e); });
  canvas.addEventListener("pointerup", () => { acelera = 0; });
  canvas.addEventListener("pointercancel", () => { acelera = 0; });
  document.getElementById("hd-overlay").addEventListener("pointerdown", comecar);
  window.addEventListener("keydown", (e) => {
    const tela = document.getElementById("screen-hilldrive");
    if (!tela || !tela.classList.contains("active")) return;
    if (e.key === "ArrowRight") { comecar(); acelera = 1; }
    if (e.key === "ArrowLeft") { comecar(); acelera = -1; }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") acelera = 0;
  });

  reset();
  requestAnimationFrame(loop);
}
