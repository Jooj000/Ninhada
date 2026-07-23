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
import { HILLDRIVE as HD } from "./config.js";
import { desenharBebe } from "./baby-sprite.js";

export function initHillDrive() {
  const canvas = document.getElementById("hd-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 420), H = (canvas.height = 260);

  const GRAV = HD.gravidade;
  const BASE = H * 0.62;

  let carro, cam, rodando, morto, lastT = 0, moedas, pegas;
  let ultimaMoedaX = 0;
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
    carro = { x: 60, y: solo(60) - 20, vx: 0, vy: 0, ang: 0, va: 0, noChao: true };
    cam = 0; rodando = false; morto = false; acelera = 0;
    moedas = []; pegas = 0;
    ultimaMoedaX = 300;
    for (let i = 0; i < 40; i++) {
      ultimaMoedaX += HD.moedaMin + Math.random() * (HD.moedaMax - HD.moedaMin);
      semearMoeda(ultimaMoedaX);
    }
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
      /* NO CHÃO
       * - o motor empurra ao longo da ladeira
       * - a gravidade puxa pela componente do declive: g·sen(θ)
       *   (por isso subida segura e descida ganha velocidade sozinha)
       * - o carro assenta no relevo, mas sem "grudar" na hora */
      const puxaoDaLadeira = Math.sin(inc) * GRAV * 1.15;
      const forca = acelera > 0 ? HD.motor : acelera < 0 ? -HD.freio : 0;
      carro.vx += (forca - puxaoDaLadeira) * dt;
      carro.vx *= Math.pow(HD.atritoSolo, dt);
      carro.vx = Math.max(HD.velMinRe, Math.min(HD.velMax, carro.vx));

      carro.ang += (inc - carro.ang) * Math.min(1, 0.22 * dt);
      carro.va *= 0.6;
      carro.y = chao - 20;
      carro.vy = 0;

      // rampa: se o chão "some" logo à frente e há velocidade, decola
      const frente = solo(carro.x + 16);
      if (carro.vx > 2.6 && frente > chao + 5) {
        carro.vy = -Math.min(10.5, carro.vx * 0.95);
        carro.va = -0.012 * carro.vx;          // sai empinando um pouquinho
        carro.y -= 3;
      }
    } else {
      /* NO AR
       * acelerar empina (gira anti-horário), frear abaixa o nariz.
       * A rotação tem inércia: por isso dá para "consertar" o pouso. */
      carro.vy += GRAV * dt;
      carro.y += carro.vy * dt;
      carro.va += -acelera * HD.torqueAr * dt;
      carro.va *= Math.pow(HD.atritoAngular, dt);
      carro.ang += carro.va * dt;

      if (carro.y >= chao - 20) {
        carro.y = chao - 20;
        carro.vy = 0;
        carro.vx *= 0.93;                       // pousada custa um pouco de velocidade
        // o carro se endireita ao tocar o chão (mas devagar: dá pra tombar)
        carro.va *= 0.35;
      }
    }

    carro.x += carro.vx * dt;
    if (carro.x < 0) { carro.x = 0; carro.vx = 0; }

    /* PERDE SÓ SE A CABEÇA DA CRIANÇA BATER NO CHÃO.
     * O carro gira em volta do PONTO DE CONTATO DAS RODAS (não do centro),
     * que é o que acontece de verdade quando um carrinho tomba. A cabeça
     * fica a `h` acima desse ponto, então girando por `ang`:
     *     cabeça = ( x + h·sen(ang) , chaoDoCarro − h·cos(ang) )
     * Ou seja: inclinar não derruba; deitar o carro (~85°+) sim.        */
    const h = HD.tamanhoCarro * (HD.alturaCabeca ?? 0.78);
    const apoio = solo(carro.x);
    const cabecaX = carro.x + h * Math.sin(carro.ang);
    const cabecaY = apoio - h * Math.cos(carro.ang);
    if (cabecaY >= solo(cabecaX) - 2) return fim("Bateu a cabeça! 🤕");

    cam = carro.x - 110;

    for (const m of moedas) {
      if (m.pego) continue;
      if (Math.abs(m.x - carro.x) < 22 && Math.abs(m.y - carro.y) < 34) { m.pego = true; pegas++; }
    }
    while (ultimaMoedaX < carro.x + 3000) {
      ultimaMoedaX += HD.moedaMin + Math.random() * (HD.moedaMax - HD.moedaMin);
      semearMoeda(ultimaMoedaX);
    }

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
    // a criança vai DENTRO, aparecendo da cintura para cima
    desenharBebe(ctx, 0, -HD.tamanhoCarro * 0.16, HD.tamanhoCarro * 0.72, { soCabeca: true });
    // o emoji do carro aponta para a ESQUERDA; espelho p/ ele "andar" à direita
    ctx.scale(-1, 1);
    ctx.font = `${HD.tamanhoCarro}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("🚙", 0, HD.tamanhoCarro * 0.34);
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
