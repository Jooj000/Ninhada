/* =====================================================================
 * goal.js — GOAL (cobrança de pênalti)
 * ---------------------------------------------------------------------
 * Regra do original (fonte: wikis do Pou): há um ALVO VERDE dentro do
 * gol e você desliza o dedo até ele para chutar. A partir de certo
 * ponto o alvo começa a se mexer, e o goleiro tenta defender.
 * Errar o gol (ou o goleiro pegar) custa uma chance.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

export function initGoal() {
  const canvas = document.getElementById("gl-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = (canvas.width = 360), H = (canvas.height = 420);

  // trave
  const GX = 40, GY = 60, GW = W - 80, GH = 150;

  let alvo, bola, goleiro, gols, chances, rodando, morto, lastT = 0, estado;
  let arrastando = null;

  function reset() {
    gols = 0; chances = 3; rodando = false; morto = false; estado = "mira";
    novoAlvo();
    bola = { x: W / 2, y: H - 60, vx: 0, vy: 0, r: 12, viva: false };
    goleiro = { x: W / 2, alvoX: W / 2, w: 54, vel: 2.4 };
    setOverlay("Toque para começar", "Deslize o dedo até o alvo verde!");
    desenhar();
  }

  function novoAlvo() {
    const mov = gols >= 3;                       // depois de 3 gols, o alvo se mexe
    alvo = {
      x: GX + 26 + Math.random() * (GW - 52),
      y: GY + 24 + Math.random() * (GH - 48),
      r: Math.max(16, 26 - gols),                // vai encolhendo
      vx: mov ? (Math.random() < 0.5 ? -1 : 1) * (0.9 + gols * 0.12) : 0,
    };
  }

  function comecar() {
    if (morto) { reset(); return; }
    if (!rodando) { rodando = true; setOverlay("", ""); }
  }

  function chutar(destX, destY) {
    if (!rodando || bola.viva || estado !== "mira") return;
    const dx = destX - bola.x, dy = destY - bola.y;
    const d = Math.hypot(dx, dy) || 1;
    const forca = 9;
    bola.vx = (dx / d) * forca; bola.vy = (dy / d) * forca;
    bola.viva = true; estado = "voando";
    // o goleiro só reage depois de um instante (senão pegava tudo)
    setTimeout(() => { goleiro.alvoX = destX + (Math.random() - 0.5) * 130; }, 130);
  }

  function update(dt) {
    if (!rodando || morto) return;

    if (alvo.vx) {
      alvo.x += alvo.vx * dt;
      if (alvo.x < GX + alvo.r || alvo.x > GX + GW - alvo.r) alvo.vx *= -1;
    }

    goleiro.x += (goleiro.alvoX - goleiro.x) * 0.06 * dt;
    goleiro.x = Math.max(GX + goleiro.w / 2, Math.min(GX + GW - goleiro.w / 2, goleiro.x));

    if (!bola.viva) return;
    bola.x += bola.vx * dt; bola.y += bola.vy * dt;
    bola.r = Math.max(5, bola.r - 0.06 * dt);        // perspectiva: diminui ao longe

    if (bola.y <= GY + GH) {                          // chegou na linha do gol
      const dentro = bola.x > GX && bola.x < GX + GW && bola.y > GY;
      const pegou = Math.abs(bola.x - goleiro.x) < goleiro.w / 2 + bola.r
                    && bola.y > GY + GH - 46;
      if (pegou) resultado(false, "O goleiro pegou! 🧤");
      else if (dentro) {
        const acertouAlvo = Math.hypot(bola.x - alvo.x, bola.y - alvo.y) < alvo.r + bola.r;
        if (acertouAlvo) resultado(true, "GOL NO ALVO! ⚽🎯");
        else resultado(false, "Fora do alvo!");
      } else resultado(false, "Pra fora! 😬");
    }
    if (bola.y < -30 || bola.x < -30 || bola.x > W + 30) resultado(false, "Pra fora! 😬");
  }

  function resultado(marcou, msg) {
    bola.viva = false; estado = "espera";
    if (marcou) gols++; else chances--;
    document.getElementById("gl-msg").textContent = msg;
    setTimeout(() => {
      if (chances <= 0) return fim();
      bola = { x: W / 2, y: H - 60, vx: 0, vy: 0, r: 12, viva: false };
      goleiro.alvoX = W / 2;
      novoAlvo();
      estado = "mira";
    }, 800);
  }

  async function fim() {
    morto = true; rodando = false;
    if (gols > 0) {
      const r = await rewardGame(getActiveBaby(), "goal", gols);
      registerCare();
      setOverlay(r.record ? `🏆 NOVO RECORDE: ${gols} gols!` : `${gols} gol(s)`,
        r.factor === 0 ? "A criança se cansou — toque p/ jogar"
          : `+${r.coins} 🪙  +${r.xp} XP${r.record ? " (com bônus!)" : r.factor < 1 ? " (cansado)" : ""} · toque p/ jogar`);
    } else setOverlay("Nenhum gol!", "Toque para tentar de novo");
  }

  function desenhar() {
    ctx.fillStyle = "#6BB77B"; ctx.fillRect(0, 0, W, H);        // gramado
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 3;
    ctx.strokeRect(GX - 22, GY, GW + 44, GH + 70);              // grande área

    // rede
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(GX, GY, GW, GH);
    ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1;
    for (let x = GX; x <= GX + GW; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x, GY + GH); ctx.stroke();
    }
    for (let y = GY; y <= GY + GH; y += 16) {
      ctx.beginPath(); ctx.moveTo(GX, y); ctx.lineTo(GX + GW, y); ctx.stroke();
    }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.strokeRect(GX, GY, GW, GH);

    // alvo verde
    ctx.fillStyle = "rgba(126,200,160,.55)"; ctx.strokeStyle = "#2E7D4F"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(alvo.x, alvo.y, alvo.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(alvo.x, alvo.y, alvo.r * 0.45, 0, Math.PI * 2); ctx.stroke();

    // goleiro
    ctx.font = "40px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("🧤", goleiro.x, GY + GH + 6);

    // linha da mira enquanto arrasta
    if (arrastando && estado === "mira") {
      ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(bola.x, bola.y);
      ctx.lineTo(arrastando.x, arrastando.y); ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.font = `${bola.r * 2}px system-ui, sans-serif`;
    ctx.fillText("⚽", bola.x, bola.y + bola.r);
    ctx.textBaseline = "alphabetic";

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

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { comecar(); arrastando = pos(e); });
  canvas.addEventListener("pointermove", (e) => { if (arrastando) arrastando = pos(e); });
  canvas.addEventListener("pointerup", (e) => {
    if (arrastando) { const p = pos(e); chutar(p.x, p.y); }
    arrastando = null;
  });
  document.getElementById("gl-overlay").addEventListener("pointerdown", comecar);

  reset();
  requestAnimationFrame(loop);
}
