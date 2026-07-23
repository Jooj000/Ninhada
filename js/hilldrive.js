/* =====================================================================
 * hilldrive.js — HILL DRIVE em TELA CHEIA com FÍSICA REALISTA
 * ---------------------------------------------------------------------
 * Direita acelera, esquerda freia/ré. O objetivo é ir longe.
 *
 * FÍSICA (reescrita do zero):
 *  - O carro tem DUAS RODAS. No chão, o ângulo do carro é simplesmente
 *    o ângulo entre os pontos de contato das rodas — ele deita no
 *    relevo de verdade, sem "perseguir o pico mais próximo".
 *  - A velocidade vive AO LONGO da ladeira: o motor empurra, a
 *    gravidade puxa g·sen(θ) (subida freia, descida embala) e o atrito
 *    desgasta. Nada de força artificial.
 *  - Decolagem NATURAL: o carro só sai do chão quando o terreno cai
 *    mais rápido do que a gravidade consegue puxá-lo (crista de morro
 *    em alta velocidade). Sem "rampa mágica" e sem torque de brinde —
 *    ou seja, ele não tenta capotar sozinho.
 *  - No ar: gravidade + torque do jogador (acelerar empina, frear
 *    abaixa o nariz). Pousar torto custa velocidade.
 *  - Perde se a CABEÇA da criança encostar no chão.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { HILLDRIVE as HD } from "./config.js";
import { desenharBebe } from "./baby-sprite.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

export function initHillDrive() {
  const canvas = document.getElementById("hd-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-hilldrive");
  const ctx = view.ctx;

  let W = 360, H = 640, s = 1, BASE = 380, CAR = 46, RODAS = 32, CLR = 20, GRAV = 0.42;

  let carro, cam, rodando, morto, lastT = 0, moedas, pegas;
  let ultimaMoedaX = 0;
  let acelera = 0;            // +1 acelerando, -1 freando/ré

  function medidas() {
    if (view.fit()) { W = view.w; H = view.h; }
    s = Math.max(1, Math.min(2.4, H / 300));
    BASE = H * 0.58;
    CAR = Math.max(40, Math.min(84, HD.tamanhoCarro * s));
    RODAS = CAR * 0.68;       // distância entre as rodas
    CLR = CAR * 0.42;         // altura do centro acima do chão
    GRAV = HD.gravidade * s;
  }

  /* Altura do terreno em qualquer x (soma de ondas: colinas suaves). */
  function solo(x) {
    return BASE
      + Math.sin(x * 0.006 / s) * 42 * s
      + Math.sin(x * 0.017 / s + 1.3) * 18 * s
      + Math.sin(x * 0.041 / s + 2.7) * 7 * s;
  }
  /* Ângulo do carro NO CHÃO: entre os pontos de contato das duas rodas. */
  function anguloRodas(x) {
    const meia = RODAS / 2;
    return Math.atan2(solo(x + meia) - solo(x - meia), RODAS);
  }
  const normAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function reset() {
    medidas();
    carro = {
      x: 60 * s, y: solo(60 * s) - CLR,
      vx: 0, vy: 0, ang: anguloRodas(60 * s), va: 0,
      noChao: true, parado: 0,
    };
    cam = 0; rodando = false; morto = false; acelera = 0;
    moedas = []; pegas = 0;
    ultimaMoedaX = 300 * s;
    for (let i = 0; i < 40; i++) {
      ultimaMoedaX += (HD.moedaMin + Math.random() * (HD.moedaMax - HD.moedaMin)) * s;
      semearMoeda(ultimaMoedaX);
    }
    lastT = 0;
    setOverlay("Toque para começar", "Direita acelera · esquerda freia");
    desenhar();
  }

  function semearMoeda(x) {
    moedas.push({ x, y: solo(x) - 34 * s, pego: false });
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  const distancia = () => Math.max(0, Math.floor(carro.x / (10 * s)));

  function update(dt) {
    if (!rodando || morto) return;

    if (carro.noChao) {
      /* ---- NO CHÃO: velocidade ao longo da ladeira ---- */
      const inc = anguloRodas(carro.x);
      const cos = Math.max(0.25, Math.cos(inc));
      // velocidade escalar ao longo da ladeira (reconstruída do vx)
      let v = carro.vx / cos;
      const forca = acelera > 0 ? HD.motor : acelera < 0 ? -HD.freio : 0;
      /* Gravidade AO LONGO da ladeira. Atenção ao sinal: y cresce para
       * BAIXO, então subida dá `inc` NEGATIVO. Somando g·sen(inc) a
       * subida freia e a descida embala — que é o certo. (Com o sinal
       * trocado o carro ganhava velocidade morro acima e vivia caçando
       * o ponto mais alto.) */
      v += (forca * s + GRAV * Math.sin(inc)) * dt;
      v *= Math.pow(HD.atritoSolo, dt);
      v = Math.max(HD.velMinRe * s, Math.min(HD.velMax * s, v));

      carro.vx = v * cos;
      carro.x += carro.vx * dt;
      if (carro.x < 0) { carro.x = 0; carro.vx = 0; v = 0; }

      const incNovo = anguloRodas(carro.x);
      const chaoY = solo(carro.x) - CLR;
      const vyLadeira = v * Math.sin(incNovo);        // componente vertical de seguir o relevo

      /* DECOLAGEM NATURAL (critério físico, sem impulso inventado):
       * para continuar colado no relevo, o carro precisaria de uma
       * aceleração para BAIXO igual à variação da sua própria velocidade
       * vertical. Quem fornece essa aceleração é a gravidade — e só ela.
       * Numa crista em velocidade, o chão foge mais rápido do que a
       * gravidade consegue puxar: aí ele voa.
       *   a_necessaria = Δvy / Δt   >   g   =>   decola          */
      const vyAntes = v * Math.sin(inc);
      const aNecessaria = (vyLadeira - vyAntes) / Math.max(dt, 0.0001);
      if (aNecessaria > GRAV && v > 0.5) {
        /* Sai pela TANGENTE da rampa que ele estava subindo — com a
         * velocidade que já tinha, sem ganhar nem perder nada. A partir
         * daqui só a gravidade age (no ramo do ar). */
        carro.noChao = false;
        carro.vy = vyAntes;
        carro.y += carro.vy * dt;
        /* GIRO DA RAMPA: no chão o carro gira junto com o relevo, na
         * taxa d(inclinação)/dt. Ao decolar ele CONSERVA esse giro — por
         * isso uma crista aguda cospe o carro rodando para trás. */
        carro.va = normAng(incNovo - inc) / Math.max(dt, 0.0001) * (HD.giroCrista ?? 0.9);
      } else {
        carro.y = chaoY;
        carro.vy = vyLadeira;
        // o carro assenta rápido no ângulo real das rodas
        carro.ang += normAng(incNovo - carro.ang) * Math.min(1, 0.5 * dt);
        carro.va = 0;
      }
    } else {
      /* ---- NO AR: gravidade + torque do jogador ---- */
      carro.vy += GRAV * dt;
      carro.x += carro.vx * dt;
      carro.y += carro.vy * dt;
      carro.va += -acelera * HD.torqueAr * dt;         // acelerar empina, frear abaixa

      /* TOPO PESADO: a criança fica ACIMA do eixo das rodas, então o
       * centro de massa está alto. Um corpo assim é instável: qualquer
       * inclinação vira torque que AUMENTA a inclinação (pêndulo
       * invertido, torque ∝ sen do ângulo). É isso que capota sozinho,
       * sem o código "mandar" capotar — e é isso que o jogador corrige
       * com os pedais. */
      carro.va += Math.sin(carro.ang) * (HD.topoPesado ?? 0.0055) * dt;
      carro.va *= Math.pow(HD.atritoAngular, dt);
      carro.ang += carro.va * dt;

      const chaoY = solo(carro.x) - CLR;
      if (carro.y >= chaoY) {
        /* pouso: as rodas grudam; pousar muito torto custa velocidade */
        carro.y = chaoY;
        const inc = anguloRodas(carro.x);
        const erro = normAng(carro.ang - inc);
        const abs = Math.abs(erro);
        carro.vy = 0;
        if (abs > 1.05) {
          /* pousou MUITO torto (~60°+): as rodas não pegam o chão, ele
           * continua tombando — daí em diante é a cabeça que decide. */
          carro.va += Math.sign(erro) * 0.02;
          carro.y -= 1;                                 // não gruda no solo
        } else {
          carro.vx *= Math.max(0.5, 1 - abs * 0.5);     // torto custa velocidade
          carro.va = erro * -0.06;                      // as rodas endireitam
          carro.noChao = true;
        }
      }
    }

    /* PERDE SÓ SE A CABEÇA DA CRIANÇA BATER NO CHÃO. A cabeça fica a `h`
     * acima da base do carro; girando pelo ângulo atual:
     *   cabeça = ( x + h·sen(ang) , base − h·cos(ang) ) */
    const h = CAR * (HD.alturaCabeca ?? 0.78);
    const baseDoCarro = carro.y + CLR;
    const cabecaX = carro.x + h * Math.sin(carro.ang);
    const cabecaY = baseDoCarro - h * Math.cos(carro.ang);
    if (cabecaY >= solo(cabecaX) + 2) return fim("Bateu a cabeça! 🤕");

    cam = carro.x - W * 0.28;

    for (const m of moedas) {
      if (m.pego) continue;
      if (Math.abs(m.x - carro.x) < 22 * s && Math.abs(m.y - carro.y) < 34 * s) { m.pego = true; pegas++; }
    }
    while (ultimaMoedaX < carro.x + W * 6) {
      ultimaMoedaX += (HD.moedaMin + Math.random() * (HD.moedaMax - HD.moedaMin)) * s;
      semearMoeda(ultimaMoedaX);
    }

    // parou de vez numa subida = fim (não dá pra continuar)
    if (carro.noChao && Math.abs(carro.vx) < 0.06 * s && acelera >= 0 && distancia() > 3) {
      carro.parado = (carro.parado || 0) + dt;
      if (carro.parado > 150) return fim("O carrinho empacou!");
    } else carro.parado = 0;
  }

  async function fim(motivo) {
    morto = true; rodando = false;
    const pontos = distancia();
    if (pontos > 0 || pegas > 0) {
      // as 🪙 pegas pagam 1:1 direto; a distância paga pouquinho
      const r = await rewardGame(getActiveBaby(), "hilldrive", pontos, distancia(), pegas);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${distancia()} m!` : `${motivo} ${distancia()} m · 🪙${pegas}`,
        r.factor === 0 && pegas === 0 ? "A criança se cansou — toque p/ jogar"
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
      ctx.lineTo(x, BASE + 30 * s + Math.sin(wx * 0.004 / s) * 34 * s);
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
    ctx.font = `${18 * s}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
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
    desenharBebe(ctx, 0, -CAR * 0.16, CAR * 0.72, { soCabeca: true });
    ctx.scale(-1, 1);
    ctx.font = `${CAR}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("🚙", 0, CAR * 0.34);
    ctx.restore();
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left"; ctx.font = "bold 18px system-ui, sans-serif"; ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${distancia()} m · 🪙 ${pegas}`, 14, 34);
    ctx.textAlign = "right"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("hilldrive")}`, W - 14, 34);

    // pedais
    const PH = Math.max(56, H * 0.1);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = acelera > 0 ? "#6BB77B" : "#000";
    ctx.fillRect(W / 2, H - PH, W / 2, PH);
    ctx.fillStyle = acelera < 0 ? "#E05A5A" : "#000";
    ctx.fillRect(0, H - PH, W / 2, PH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#4A3F55"; ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("◀ FREIO", W * 0.25, H - PH / 2 + 5);
    ctx.fillText("ACELERAR ▶", W * 0.75, H - PH / 2 + 5);
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

  view.onResize = reset;
  onScreenShown("screen-hilldrive", reset);
  onScreenLeft("screen-hilldrive", reset);
  reset();
  requestAnimationFrame(loop);
}
