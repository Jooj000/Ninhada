/* =====================================================================
 * goal.js — GOAL (cobrança de pênalti)
 * ---------------------------------------------------------------------
 * Como no original: NÃO existe força de chute, só DIREÇÃO. O alvo verde
 * corre na HORIZONTAL dentro do gol e você escolhe onde a bola vai.
 *
 * O goleiro é a própria criança: ela se joga para o lado da bola e
 * DEFENDE tudo que não passar dentro do alvo. Ou seja, o alvo é
 * justamente o cantinho onde ela não alcança.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { desenharBebe } from "./baby-sprite.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

export function initGoal() {
  /* Conta as partidas. Uma recompensa que chega DEPOIS de o jogador
   * já ter recomeçado pertence a outra partida e deve ser ignorada —
   * era isso que fazia a tela de morte reaparecer por cima do jogo. */
  let runId = 0;
  const canvas = document.getElementById("gl-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-goal");
  const ctx = view.ctx;

  let W = 360, H = 640, sy = 1;
  let GX = 52, GY = 74, GW = 256, GH = 128, LINHA = 202;
  let BOLA0 = { x: 180, y: 584 }, V = 8.5;

  let alvo, bola, goleiro, gols, chances, rodando, morto, estado, lastT = 0;
  let mira = W / 2, apontando = false;

  function medidas() {
    if (view.fit()) { W = view.w; H = view.h; }
    sy = Math.max(1, H / 420);
    GX = W * 0.14; GW = W * 0.72;
    GY = H * 0.15; GH = Math.min(H * 0.30, 200);
    LINHA = GY + GH;
    BOLA0 = { x: W / 2, y: H - 64 * Math.min(sy, 1.4) };
    V = 8.5 * sy;                                     // chute cruza a tela no mesmo tempo
  }

  function reset() {
    runId++;                      // nova partida: invalida recompensas pendentes
    medidas();
    lastT = 0;
    gols = 0; chances = 3; rodando = false; morto = false; estado = "mira";
    mira = W / 2;
    novoAlvo();
    bola = { ...BOLA0, vx: 0, vy: 0, r: 13 * Math.min(sy, 1.5), viva: false, t: 0 };
    goleiro = { x: W / 2, alvoX: W / 2, pulo: 0, defendeu: false };
    setOverlay("Toque para começar", "Arraste para escolher o LADO e solte");
    desenhar();
  }

  function novoAlvo() {
    const larg = Math.max(GW * 0.18, GW * 0.33 - gols * GW * 0.02); // vai apertando
    const move = gols >= 2;
    alvo = {
      x: GX + larg / 2 + Math.random() * (GW - larg),
      larg,
      vx: move ? (Math.random() < 0.5 ? -1 : 1) * (1.1 + gols * 0.22) : 0,
    };
  }

  function comecar() {
    if (morto) { reset(); return; }
    rodando = true; setOverlay("", "");   // sempre limpa o overlay
  }

  /* Chuta: só a DIREÇÃO importa; a velocidade é sempre a mesma. */
  function chutar() {
    if (!rodando || bola.viva || estado !== "mira") return;
    const destinoX = Math.max(GX + 6, Math.min(GX + GW - 6, mira));
    const dx = destinoX - bola.x, dy = LINHA - 30 - bola.y;
    const d = Math.hypot(dx, dy) || 1;
    bola.vx = (dx / d) * V; bola.vy = (dy / d) * V;
    bola.viva = true; bola.destinoX = destinoX;
    estado = "voando";
    goleiro.defendeu = false;
  }

  function update(dt) {
    if (!rodando || morto) return;

    // alvo corre só na horizontal
    if (alvo.vx) {
      alvo.x += alvo.vx * dt;
      if (alvo.x - alvo.larg / 2 < GX) { alvo.x = GX + alvo.larg / 2; alvo.vx *= -1; }
      if (alvo.x + alvo.larg / 2 > GX + GW) { alvo.x = GX + GW - alvo.larg / 2; alvo.vx *= -1; }
    }

    // goleiro: fica no meio; quando a bola sai, se joga para o lado dela
    const destino = bola.viva ? bola.destinoX : W / 2;
    goleiro.alvoX += (destino - goleiro.alvoX) * Math.min(1, 0.075 * dt);
    goleiro.x += (goleiro.alvoX - goleiro.x) * Math.min(1, 0.16 * dt);
    goleiro.pulo = bola.viva ? Math.min(1, goleiro.pulo + 0.05 * dt) : Math.max(0, goleiro.pulo - 0.1 * dt);

    if (!bola.viva) return;
    bola.x += bola.vx * dt; bola.y += bola.vy * dt;
    bola.t += dt;
    bola.r = Math.max(6, 13 * Math.min(sy, 1.5) - bola.t * 0.08 * sy);          // afasta = diminui

    if (bola.y <= LINHA - 26) {
      const dentroDoGol = bola.x > GX && bola.x < GX + GW;
      const noAlvo = Math.abs(bola.x - alvo.x) < alvo.larg / 2;
      if (!dentroDoGol) resultado(false, "Pra fora! 😬");
      else if (noAlvo) resultado(true, "GOL! ⚽🎯");
      else { goleiro.defendeu = true; resultado(false, "A criança defendeu! 🧤"); }
    }
  }

  function resultado(marcou, msg) {
    bola.viva = false; estado = "espera";
    if (marcou) gols++; else chances--;
    const el = document.getElementById("gl-msg");
    if (el) el.textContent = msg;
    setTimeout(() => {
      if (chances <= 0) return fim();
      bola = { ...BOLA0, vx: 0, vy: 0, r: 13 * Math.min(sy, 1.5), viva: false, t: 0 };
      goleiro.pulo = 0; goleiro.defendeu = false;
      novoAlvo();
      estado = "mira";
    }, 850);
  }

  async function fim() {
    morto = true; rodando = false;
    if (gols > 0) {
      const meuRun = runId;
      const r = await rewardGame(getActiveBaby(), "goal", gols);
      if (meuRun !== runId) return;   // o jogador já recomeçou: não mexe na tela
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${gols} gols!` : `${gols} gol(s)`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Nenhum gol!", "Toque para tentar de novo");
  }

  function desenhar() {
    ctx.fillStyle = "#6BB77B"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#63AE74";
    for (let i = 0; i < 6; i++) ctx.fillRect(0, GY + GH + 20 + i * 34, W, 17);

    ctx.strokeStyle = "rgba(255,255,255,.32)"; ctx.lineWidth = 3;
    ctx.strokeRect(GX - 20, GY, GW + 40, GH + 66);

    // rede
    ctx.fillStyle = "rgba(255,255,255,.13)"; ctx.fillRect(GX, GY, GW, GH);
    ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1;
    for (let x = GX; x <= GX + GW; x += 15) { ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x, GY + GH); ctx.stroke(); }
    for (let y = GY; y <= GY + GH; y += 15) { ctx.beginPath(); ctx.moveTo(GX, y); ctx.lineTo(GX + GW, y); ctx.stroke(); }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.strokeRect(GX, GY, GW, GH);

    // ALVO: faixa vertical que corre na horizontal
    ctx.fillStyle = "rgba(126,220,150,.45)";
    ctx.fillRect(alvo.x - alvo.larg / 2, GY + 3, alvo.larg, GH - 6);
    ctx.strokeStyle = "#2E7D4F"; ctx.lineWidth = 3;
    ctx.strokeRect(alvo.x - alvo.larg / 2, GY + 3, alvo.larg, GH - 6);
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MIRE AQUI", alvo.x, GY + GH / 2);

    // GOLEIRA = a própria criança (boneco completo equipado), que se joga
    const gy = LINHA - 4 - goleiro.pulo * 18;
    const inclina = (goleiro.x - W / 2) / (GW / 2) * goleiro.pulo * 0.9;
    desenharBebe(ctx, goleiro.x, gy, GH * 1.05, {   // do tamanho do gol
      giro: inclina,
      espelhar: goleiro.x < W / 2,
    });
    if (goleiro.defendeu) {                     // luva só no momento da defesa
      ctx.font = "22px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🧤", goleiro.x + (goleiro.x < W / 2 ? -24 : 24), gy - 40);
      ctx.textBaseline = "alphabetic";
    }

    // mira: só direção (uma seta horizontal)
    if (estado === "mira" && rodando) {
      const mx = Math.max(GX + 6, Math.min(GX + GW - 6, mira));
      ctx.strokeStyle = apontando ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.45)";
      ctx.lineWidth = 3; ctx.setLineDash([7, 7]);
      ctx.beginPath(); ctx.moveTo(BOLA0.x, BOLA0.y); ctx.lineTo(mx, LINHA - 26); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(mx, LINHA - 26, 6, 0, Math.PI * 2); ctx.fill();
    }

    ctx.textAlign = "center";
    ctx.font = `${bola.r * 2}px system-ui, sans-serif`;
    ctx.fillText("⚽", bola.x, bola.y + bola.r);

    ctx.textAlign = "left"; ctx.font = "bold 16px system-ui, sans-serif"; ctx.fillStyle = "#fff";
    ctx.fillText(`⚽ ${gols}   ${"❤️".repeat(Math.max(0, chances))}`, 12, 28);
    ctx.textAlign = "right"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(`🏆 ${getRecord("goal")}`, W - 12, 28);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t; update(dt); desenhar();
    requestAnimationFrame(loop);
  }

  function setOverlay(title, sub) {
    const ov = document.getElementById("gl-overlay");
    if (!ov) return;
    ov.style.display = title || sub ? "flex" : "none";
    ov.querySelector(".mini-title").textContent = title;
    ov.querySelector(".mini-sub").textContent = sub;
  }

  view.onResize = reset;
  onScreenShown("screen-goal", reset);
  onScreenLeft("screen-goal", reset);

  const px = (e) => {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;       // só a horizontal importa
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { comecar(); apontando = true; mira = px(e); });
  canvas.addEventListener("pointermove", (e) => { if (apontando) mira = px(e); });
  canvas.addEventListener("pointerup", () => { if (apontando) chutar(); apontando = false; });
  canvas.addEventListener("pointercancel", () => { apontando = false; });
  document.getElementById("gl-overlay").addEventListener("pointerdown", comecar);

  reset();
  requestAnimationFrame(loop);
}
