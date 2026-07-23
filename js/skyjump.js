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
import { SKYJUMP as SJ } from "./config.js";

export function initSkyJump() {
  const canvas = document.getElementById("sj-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 320);
  const H = (canvas.height = 460);

  const GRAV = SJ.gravidade, PULO = -SJ.forcaPulo, LARG = 62, ALT = 12;
  const N_PLATS = SJ.plataformas;
  /* Vão entre plataformas: o máximo fica logo abaixo da altura do pulo
   * (forcaPulo² / 2·gravidade ≈ 155 px), então sempre dá pra alcançar —
   * mas por pouco. */
  const VAO_MIN = SJ.vaoMin, VAO_MAX = SJ.vaoMax;
  const sorteiaVao = () => VAO_MIN + Math.random() * (VAO_MAX - VAO_MIN);
  let heroi, plats, altura, camera, rodando, morto, lastT = 0, alvoX = null;
  let moedas, metrosPagos;

  function novaPlat(y) {
    const quebra = altura > 300 && Math.random() < SJ.chanceQuebra;
    const p = { x: 10 + Math.random() * (W - LARG - 20), y, quebra, usada: false };
    // ~28% das plataformas trazem uma moeda flutuando acima
    if (Math.random() < SJ.chanceMoeda) p.moeda = { dy: -26, pego: false };
    return p;
  }

  function reset() {
    heroi = { x: W / 2 - 16, y: H - 120, vy: 0, vx: 0, w: 32, h: 32 };
    plats = [{ x: W / 2 - LARG / 2, y: H - 60, quebra: false, usada: false }];
    { let y = H - 60; for (let i = 1; i < N_PLATS; i++) { y -= sorteiaVao(); plats.push(novaPlat(y)); } }
    altura = 0; camera = 0; rodando = false; morto = false; alvoX = null;
    moedas = 0; metrosPagos = 0;
    setOverlay("Toque para começar", "Arraste para os lados!");
    desenhar();
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; heroi.vy = PULO; setOverlay("", ""); }
  }

  function update(dt) {
    if (!rodando || morto) return;

    // horizontal: o dedo tem prioridade; sem dedo, vale a inclinação
    if (alvoX !== null) {
      heroi.vx = (alvoX - (heroi.x + heroi.w / 2)) * 0.18;
    } else if (tiltLigado && Math.abs(inclinacao) > 0.06) {
      heroi.vx += inclinacao * (SJ.sensibilidadeInclinacao ?? 1.1) * dt;
    }
    heroi.vx *= 0.88;
    heroi.x += heroi.vx * dt;
    // ATRAVESSAR A BORDA: sai de um lado, entra pelo outro
    if (heroi.x + heroi.w < 0) heroi.x = W;
    else if (heroi.x > W) heroi.x = -heroi.w;

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
    while (plats.length < N_PLATS) {
      const maisAlta = Math.min(...plats.map((p) => p.y));
      plats.push(novaPlat(maisAlta - sorteiaVao()));
    }

    // pegar moedas (basta encostar)
    for (const p of plats) {
      if (!p.moeda || p.moeda.pego) continue;
      const mx = p.x + LARG / 2, my = p.y + p.moeda.dy;
      if (Math.abs(heroi.x + heroi.w / 2 - mx) < 24 &&
          Math.abs(heroi.y + heroi.h / 2 - my) < 26) {
        p.moeda.pego = true; moedas++;
      }
    }

    if (heroi.y > H + 40) fim();
  }

  const metros = () => Math.floor(altura / 10);
  /* 1 ponto por moeda pega + 1 ponto a cada 100 m percorridos.
   * Cada ponto vale 1 moeda + 3 XP (antes do multiplicador de idade). */
  const pontos = () => moedas + Math.floor(metros() / 100);

  async function fim() {
    morto = true; rodando = false;
    const p = pontos();
    if (p > 0) {
      const r = await rewardGame(getActiveBaby(), "skyjump", p, metros());
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${metros()} m!` : `Você subiu ${metros()} m`,
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
      if (p.moeda && !p.moeda.pego) {
        ctx.font = "20px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🪙", p.x + LARG / 2, p.y + p.moeda.dy);
      }
    }

    // o bebê: base do emoji EXATAMENTE nos pés (senão ele afunda na plataforma)
    ctx.font = "30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("👶", heroi.x + heroi.w / 2, heroi.y + heroi.h);
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left";
    ctx.font = "bold 16px system-ui, sans-serif"; ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${metros()} m · 🪙 ${moedas}`, 12, 26);
    ctx.textAlign = "right"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("skyjump")}`, W - 12, 26);
    if (tiltLigado) {
      ctx.fillStyle = "rgba(74,63,85,.5)";
      ctx.fillText("📱 incline o celular", W - 12, 44);
    }
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

  /* ---------------- INCLINAÇÃO (só celular) ----------------
   * `gamma` é a inclinação esquerda/direita em graus. Enquanto o dedo
   * estiver na tela, o toque manda (a inclinação fica em espera).
   * No iOS 13+ é obrigatório pedir permissão a partir de um toque. */
  let inclinacao = 0, tiltLigado = false;

  const ehCelular = () =>
    window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

  function ouvirInclinacao() {
    if (tiltLigado) return;
    tiltLigado = true;
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma == null) return;
      // limita a ±35°, o suficiente para virar o celular sem exagero
      inclinacao = Math.max(-35, Math.min(35, e.gamma)) / 35;
    });
  }

  async function ligarInclinacao() {
    if (!ehCelular()) return;
    const D = window.DeviceOrientationEvent;
    if (!D) return;
    if (typeof D.requestPermission === "function") {     // iOS 13+
      try {
        const r = await D.requestPermission();
        if (r === "granted") ouvirInclinacao();
      } catch (_) { /* usuário recusou: continua no toque */ }
    } else {
      ouvirInclinacao();                                  // Android
    }
  }

  const seguir = (e) => {
    const rect = canvas.getBoundingClientRect();
    alvoX = ((e.clientX - rect.left) / rect.width) * W;
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { ligarInclinacao(); comecar(); seguir(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.buttons) seguir(e); });
  canvas.addEventListener("pointerup", () => { alvoX = null; });
  document.getElementById("sj-overlay").addEventListener("pointerdown", () => { ligarInclinacao(); comecar(); });

  window.addEventListener("keydown", (e) => {
    const tela = document.getElementById("screen-skyjump");
    if (!tela || !tela.classList.contains("active")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); alvoX = heroi.x - 40; }
    if (e.key === "ArrowRight") { e.preventDefault(); alvoX = heroi.x + 72; }
  });

  reset();
  requestAnimationFrame(loop);
}
