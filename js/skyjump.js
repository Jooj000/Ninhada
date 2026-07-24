/* =====================================================================
 * skyjump.js — SKY JUMP em TELA CHEIA (estilo Doodle Jump)
 * ---------------------------------------------------------------------
 * O bebê pula sozinho; arraste (ou incline) para os lados. A física
 * vertical é ABSOLUTA (px), então a altura do pulo é a mesma em qualquer
 * tela — só entram MAIS plataformas na vertical em telas altas.
 * Pontos = 1 a cada 100 m; as 🪙 pegas pagam 1:1 por fora.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { SKYJUMP as SJ } from "./config.js";
import { desenharBebe } from "./baby-sprite.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

export function initSkyJump() {
  /* Conta as partidas. Uma recompensa que chega DEPOIS de o jogador
   * já ter recomeçado pertence a outra partida e deve ser ignorada —
   * era isso que fazia a tela de morte reaparecer por cima do jogo. */
  let runId = 0;
  const canvas = document.getElementById("sj-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-skyjump");
  const ctx = view.ctx;

  /* PROPORÇÕES DO ORIGINAL (canvas 320×460): o vertical escala por
   * sy = H/460 e o horizontal por sx = W/320. Gravidade e impulso
   * escalam juntos, então a altura do pulo é sempre a MESMA fração da
   * tela. (Antes a física era absoluta: no PC o mapa ficava enorme e os
   * pulos, minúsculos.) */
  const REF_W = 320, REF_H = 460;
  let W = 360, H = 640, sx = 1, sy = 1;
  let LARG = 66, N_PLATS = 8, ALT = 12;
  let GRAV = SJ.gravidade, PULO = -SJ.forcaPulo;
  let VAO_MIN = SJ.vaoMin, VAO_MAX = SJ.vaoMax;
  const sorteiaVao = () => VAO_MIN + Math.random() * (VAO_MAX - VAO_MIN);

  let heroi, plats, altura, camera, rodando, morto, lastT = 0, alvoX = null;
  let moedas;
  let setaX = 0;                 // -1 / 0 / +1 pelas setas do teclado
  let platAtual = null;          // plataforma pisada por último (base da câmera)
  const VMAX_H = () => (SJ.velMaxH ?? 6.5) * sx;
  let grausSuaves = 0;           // leitura do sensor JÁ filtrada

  function medidas() {
    if (view.fit()) { W = view.w; H = view.h; }
    sx = W / REF_W; sy = H / REF_H;

    GRAV = SJ.gravidade * sy;          // juntos = altura do pulo proporcional
    PULO = -SJ.forcaPulo * sy;
    VAO_MIN = SJ.vaoMin * sy;          // o vão acompanha o pulo
    VAO_MAX = SJ.vaoMax * sy;
    LARG = W * (SJ.larguraPlataforma ?? 1 / 6);
    ALT = 12 * sy;
    // com o vão proporcional, o número de plataformas na tela é constante
    N_PLATS = Math.ceil(H / ((VAO_MIN + VAO_MAX) / 2)) + 3;
  }

  function novaPlat(y) {
    const quebra = altura > 300 * sy && Math.random() < SJ.chanceQuebra;
    const p = { x: 10 * sx + Math.random() * Math.max(10, W - LARG - 20 * sx), y, quebra, usada: false };
    if (Math.random() < SJ.chanceMoeda) p.moeda = { dy: -26 * sy, pego: false };
    return p;
  }

  function reset() {
    runId++;                      // nova partida: invalida recompensas pendentes
    medidas();
    const TAM = 32 * Math.min(sx, sy);
    heroi = { x: W / 2 - TAM / 2, y: H - 120 * sy, vy: 0, vx: 0, w: TAM, h: TAM };
    plats = [{ x: W / 2 - LARG / 2, y: H - 60 * sy, quebra: false, usada: false }];
    { let y = H - 60 * sy; for (let i = 1; i < N_PLATS; i++) { y -= sorteiaVao(); plats.push(novaPlat(y)); } }
    altura = 0; camera = 0; rodando = false; morto = false; alvoX = null;
    moedas = 0; lastT = 0; setaX = 0; grausSuaves = 0;
    platAtual = plats[0];
    setOverlay("Toque para começar", "Arraste para os lados!");
    desenhar();
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; heroi.vy = PULO; }
    setOverlay("", "");   // sempre limpa o overlay
  }

  function update(dt) {
    if (!rodando || morto) return;

    /* ============ HORIZONTAL (modelo do Pou) ============
     * A INCLINAÇÃO dá VELOCIDADE, não aceleração: o ângulo mapeia
     * direto para vx. Não há atrito nenhum. A única "inércia" é um
     * amortecedor levíssimo, só para o movimento não dar degrau seco —
     * ao voltar ao centro, o boneco simplesmente para de andar.
     * O TOQUE e o TECLADO continuam com o comportamento antigo. */
    const VMAX = VMAX_H();
    let alvo = null;

    if (tiltLigado) {
      const zona = SJ.zonaMortaGraus ?? 3;
      const gMax = SJ.grausMax ?? 24;
      const excesso = Math.abs(grausSuaves) - zona;
      // velocidade PROPORCIONAL ao ângulo (dentro da zona morta: parado)
      alvo = excesso <= 0 ? 0
           : Math.sign(grausSuaves) * Math.min(1, excesso / Math.max(1, gMax - zona)) * VMAX;
    }

    /* ---- toque: inalterado (persegue o dedo) ---- */
    if (alvoX !== null) {
      const d = alvoX - (heroi.x + heroi.w / 2);
      const porToque = Math.max(-1, Math.min(1, d / (W * 0.28))) * VMAX;
      alvo = alvo === null ? porToque : porToque;      // o dedo tem prioridade
    }
    /* ---- teclado: inalterado ---- */
    if (setaX !== 0) alvo = setaX * VMAX;

    if (alvo !== null) {
      // amortecedor leve: aproxima vx do alvo sem degrau (sem atrito)
      const k = Math.min(1, (SJ.amortecedor ?? 0.35) * dt);
      heroi.vx += (alvo - heroi.vx) * k;
    }

    heroi.vx = Math.max(-VMAX, Math.min(VMAX, heroi.vx));

    heroi.x += heroi.vx * dt;
    if (heroi.x + heroi.w < 0) heroi.x = W;       // atravessa a borda
    else if (heroi.x > W) heroi.x = -heroi.w;

    heroi.vy += GRAV * dt;
    heroi.y += heroi.vy * dt;

    if (heroi.vy > 0) {
      for (const p of plats) {
        if (p.sumiu) continue;
        const emCima = heroi.y + heroi.h >= p.y && heroi.y + heroi.h <= p.y + ALT + heroi.vy * dt;
        const dentro = heroi.x + heroi.w > p.x && heroi.x < p.x + LARG;
        if (emCima && dentro) {
          platAtual = p;                      // vira a "base" da câmera
          heroi.vy = PULO;
          if (p.quebra) p.sumiu = true;
          break;
        }
      }
    }

    /* CÂMERA (como no Pou): a plataforma em que ele acabou de pisar
     * vira a MAIS BAIXA, com a base a ~8% do rodapé. O mundo desce até
     * lá suavemente, em vez de rolar por um limiar de altura. */
    if (platAtual && !platAtual.sumiu) {
      const alvoY = H * (1 - (SJ.baseAcimaDoRodape ?? 0.08));
      const d = alvoY - platAtual.y;
      if (d > 0.5) {
        const passo = Math.min(d, d * 0.25 * dt);
        heroi.y += passo; camera += passo; altura += passo;
        for (const p of plats) p.y += passo;
      }
    }

    plats = plats.filter((p) => p.y < H + 30 * sy);
    while (plats.length < N_PLATS) {
      const maisAlta = Math.min(...plats.map((p) => p.y));
      plats.push(novaPlat(maisAlta - sorteiaVao()));
    }

    for (const p of plats) {
      if (!p.moeda || p.moeda.pego) continue;
      const mx = p.x + LARG / 2, my = p.y + p.moeda.dy;
      if (Math.abs(heroi.x + heroi.w / 2 - mx) < 24 * sx &&
          Math.abs(heroi.y + heroi.h / 2 - my) < 26 * sy) {
        p.moeda.pego = true; moedas++;
      }
    }

    if (heroi.y > H + 40 * sy) fim();
  }

  // metros medidos NA ESCALA DE REFERÊNCIA: a pontuação não muda com a tela
  const metros = () => Math.floor(altura / (10 * sy));
  /* 1 ponto a cada 100 m. As 🪙 NÃO viram pontos: pagam 1:1 por fora. */
  const pontos = () => Math.floor(metros() / 100);

  async function fim() {
    morto = true; rodando = false;
    const p = pontos();
    if (p > 0 || moedas > 0) {
      const meuRun = runId;
      const r = await rewardGame(getActiveBaby(), "skyjump", p, metros(), moedas);
      if (meuRun !== runId) return;   // o jogador já recomeçou: não mexe na tela
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${metros()} m!` : `Você subiu ${metros()} m · 🪙${moedas}`,
        r.factor === 0 && moedas === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Caiu!", "Toque para tentar de novo");
  }

  function desenhar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#CFE8F7"); g.addColorStop(1, "#EAF4FB");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    const nNuvens = Math.ceil(H / 110);
    for (let i = 0; i < nNuvens; i++) {
      const y = ((i * 120 + camera * 0.25) % (H + 80)) - 40;
      ctx.beginPath();
      ctx.ellipse(40 + ((i * 97) % Math.max(80, W - 80)), y, 38, 14, 0, 0, Math.PI * 2);
      ctx.fill();
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
    ctx.textBaseline = "alphabetic";

    desenharBebe(ctx, heroi.x + heroi.w / 2, heroi.y + heroi.h, 42 * Math.min(sx, sy),
                 { espelhar: heroi.vx < -0.4 });

    ctx.textAlign = "left";
    ctx.font = "bold 18px system-ui, sans-serif"; ctx.fillStyle = "#4A3F55";
    ctx.fillText(`${metros()} m · 🪙 ${moedas}`, 14, 34);
    ctx.textAlign = "right"; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "#8A7E96";
    ctx.fillText(`🏆 ${getRecord("skyjump")}`, W - 14, 34);
    if (tiltLigado) {
      ctx.fillStyle = "rgba(74,63,85,.5)";
      ctx.fillText("📱 incline o celular", W - 14, 54);
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

  /* ---------------- INCLINAÇÃO (só celular) ---------------- */
  let tiltLigado = false;

  const ehCelular = () =>
    window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

  function ouvirInclinacao() {
    if (tiltLigado) return;
    tiltLigado = true;
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma == null) return;
      const g = SJ.grausMax ?? 24;
      const bruto = Math.max(-g, Math.min(g, e.gamma));

      /* FILTRO PASSA-BAIXA ADAPTATIVO.
       * Um filtro de ganho fixo atrasa TUDO por igual: como o sensor
       * costuma reportar a 10–30 Hz, virar o celular de uma vez levava
       * de 200 a 400 ms só para o valor filtrado cruzar a zona morta —
       * era esse o "delay" antes de o boneco sair do lugar.
       * Agora o ganho CRESCE com o tamanho da variação: virada grande e
       * proposital passa quase direto (~1 leitura), enquanto o tremor de
       * mão, que é pequeno, continua sendo suavizado. */
      const base = SJ.filtroInclinacao ?? 0.45;
      const salto = SJ.saltoInclinacao ?? 4;         // graus p/ considerar "de propósito"
      const delta = Math.abs(bruto - grausSuaves);
      const k = Math.min(1, base + (1 - base) * Math.min(1, delta / salto));
      grausSuaves += (bruto - grausSuaves) * k;
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
      } catch (_) { /* recusou: fica no toque */ }
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
  /* no WINDOW: se o dedo escorregar para fora do canvas, o alvo é
   * liberado do mesmo jeito (se ficasse preso, o arraste continuaria
   * "puxando" o boneco e a inclinação parecia morta). */
  const soltar = () => { alvoX = null; };
  window.addEventListener("pointerup", soltar);
  window.addEventListener("pointercancel", soltar);
  canvas.addEventListener("lostpointercapture", soltar);
  document.getElementById("sj-overlay").addEventListener("pointerdown", () => { ligarInclinacao(); comecar(); });

  window.addEventListener("keydown", (e) => {
    const tela = document.getElementById("screen-skyjump");
    if (!tela || !tela.classList.contains("active")) return;
    if (e.key === "ArrowLeft")  { e.preventDefault(); setaX = -1; }
    if (e.key === "ArrowRight") { e.preventDefault(); setaX = 1; }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" && setaX < 0) setaX = 0;
    if (e.key === "ArrowRight" && setaX > 0) setaX = 0;
  });

  view.onResize = reset;
  onScreenShown("screen-skyjump", reset);
  onScreenLeft("screen-skyjump", reset);
  reset();
  requestAnimationFrame(loop);
}
