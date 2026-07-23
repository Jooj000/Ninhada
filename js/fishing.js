/* =====================================================================
 * fishing.js — PESCARIA em TELA CHEIA (estilo Stardew Valley)
 * ---------------------------------------------------------------------
 * Segure para SUBIR a rede; solte para descer. Mantenha o peixe dentro
 * para encher a barra; se ela zerar, o peixe foge e a pescaria acaba.
 *
 * NOVIDADES:
 *   - BAÚ 📦: durante a luta pode surgir num ponto aleatório do trilho.
 *     Passe a rede por cima dele (sem largar o peixe!) por um instante
 *     para abrir — paga moedas na hora, 1:1.
 *   - CADERNO 📖: cada peixe fisgado é registrado na casa (Firebase);
 *     o botão do caderno mostra quantos de cada espécie já pescaram.
 * ===================================================================== */

import { rewardGame, getRecord, logFish } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { getWeather } from "./weather.js";
import { BALANCE } from "./config.js";
import { fullscreenCanvas, onScreenShown, onScreenLeft } from "./fs-canvas.js";

const F = BALANCE.fishing;

/* `clima`: em qual tempo o peixe aparece (vazio = sempre). */
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

function perfil(p) {
  return {
    ...p,
    vel:      F.velBase      + p.pontos * F.velPerPoint,
    erratico: F.erraticBase  + p.pontos * F.erraticPerPoint,
    fuga:     F.fugaBase     + p.pontos * F.fugaPerPoint,
  };
}

function sortearPeixe(total) {
  const w = getWeather();
  const clima = w ? w.main : "clear";
  const cand = [];
  for (const p of PEIXES) {
    const combina = p.clima.length === 0 || p.clima.includes(clima);
    if (!combina) continue;
    const peso = Math.max(0.4, (10 - p.pontos) + total / 8);
    cand.push({ p, peso });
  }
  const soma = cand.reduce((s, c) => s + c.peso, 0);
  let r = Math.random() * soma;
  for (const c of cand) { r -= c.peso; if (r <= 0) return perfil(c.p); }
  return perfil(PEIXES[0]);
}

export function initFishing() {
  /* Conta as partidas. Uma recompensa que chega DEPOIS de o jogador
   * já ter recomeçado pertence a outra partida e deve ser ignorada —
   * era isso que fazia a tela de morte reaparecer por cima do jogo. */
  let runId = 0;
  const canvas = document.getElementById("fish-canvas");
  if (!canvas) return;
  const view = fullscreenCanvas(canvas, "screen-fishing");
  const ctx = view.ctx;

  let W = 360, H = 640, TRX = 100, TRW = 160, BAR_H = F.netHeightPx, sy = 1;
  let barY, barV, fishY, fishV, fishTarget, progresso, peixe, estado, total, lastT = 0;
  let esperaAte = 0, fisgarAte = 0;
  let segurando = false;
  let caught = {};      // { nomeDoPeixe: quantos } nesta pescaria
  let baus = 0;         // baús abertos nesta pescaria
  let bau = null;       // { y, someEm, seguradoMs } ou null
  let bauSorteado = false;

  const msg = document.getElementById("fish-msg");
  const info = document.getElementById("fish-info");

  function medidas() {
    if (view.fit()) { W = view.w; H = view.h; }
    TRX = W * 0.28; TRW = W * 0.44;
    /* TUDO escala com a altura: o jogo original foi afinado em H = 420,
     * então a rede, a VELOCIDADE da rede e a do peixe crescem juntas —
     * a luta fica idêntica em qualquer tela (só mais nítida). */
    sy = H / 420;
    BAR_H = H * (F.netHeightPx / 420);
  }

  function lancar() {
    estado = "esperando";
    peixe = sortearPeixe(total);
    esperaAte = performance.now() + F.esperaMinMs + Math.random() * (F.esperaMaxMs - F.esperaMinMs);
    const w = getWeather();
    info.textContent = w ? `Tempo: ${w.desc} — atrai peixes diferentes` : "";
    msg.textContent = "Aguarde a fisgada…";
  }

  function morder(agora) {
    estado = "mordendo";
    fisgarAte = agora + F.janelaFisgadaMs;
    msg.textContent = "❗ FISGUE AGORA!";
    if (navigator.vibrate) navigator.vibrate(60);
  }

  function começarLuta() {
    barY = H - BAR_H - 10; barV = 0;
    fishY = H / 2; fishV = 0; fishTarget = H / 2;
    progresso = 0.35;
    estado = "pescando";
    bau = null; bauSorteado = false;
    info.textContent = `${peixe.emoji} ${peixe.nome} — vale ${peixe.pontos} ponto(s)`;
    msg.textContent = "Segure para subir a rede!";
  }

  function perdeuFisgada() {
    encerrar("Soltou a isca… (demorou a fisgar) A pescaria acabou.");
  }

  /* O baú surge UMA vez por peixe, num momento e ponto aleatórios. */
  function talvezBau(dt) {
    const agora = performance.now();
    if (bau) {
      if (agora >= bau.someEm) { bau = null; return; }
      // rede em cima do baú? acumula tempo de coleta
      const dentro = bau.y > barY && bau.y < barY + BAR_H;
      if (dentro) {
        bau.seguradoMs += dt * (1000 / 60);
        if (bau.seguradoMs >= (F.bauSegurarMs ?? 500)) {
          baus++;
          bau = null;
          msg.textContent = `📦 Baú aberto! +${F.bauCoins ?? 5} 🪙`;
          if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
        }
      } else if (bau.seguradoMs > 0) {
        bau.seguradoMs = Math.max(0, bau.seguradoMs - dt * (500 / 60));
      }
      return;
    }
    if (bauSorteado) return;
    // sorteia cedo na luta (entre 15% e 70% de progresso vivido)
    if (Math.random() < 0.01 * dt) {
      bauSorteado = true;
      if (Math.random() < (F.bauChance ?? 0.55)) {
        bau = {
          y: 40 + Math.random() * (H - 80),
          someEm: performance.now() + (F.bauDuracaoMs ?? 4500),
          seguradoMs: 0,
        };
      }
    }
  }

  function update(dt) {
    const agora = performance.now();
    if (estado === "esperando") { if (agora >= esperaAte) morder(agora); return; }
    if (estado === "mordendo")  { if (agora >= fisgarAte) perdeuFisgada(); return; }
    if (estado !== "pescando") return;

    barV += (segurando ? -0.55 : 0.42) * sy * dt;
    barV *= 0.92;
    barY += barV * dt;
    if (barY < 0) { barY = 0; barV = 0; }
    if (barY > H - BAR_H) { barY = H - BAR_H; barV = 0; }

    if (Math.random() < peixe.erratico * dt) fishTarget = 20 + Math.random() * (H - 40);
    const dir = Math.sign(fishTarget - fishY);
    fishV += dir * 0.14 * peixe.vel * sy * dt;
    fishV *= 0.9;
    fishY += fishV * dt;
    if (fishY < 12) { fishY = 12; fishV = 0; fishTarget = H / 2; }
    if (fishY > H - 12) { fishY = H - 12; fishV = 0; fishTarget = H / 2; }

    const dentro = fishY > barY && fishY < barY + BAR_H;
    progresso += (dentro ? F.ganhoNaRede : -(peixe.fuga || 0.0042)) * dt;
    progresso = Math.max(0, Math.min(1, progresso));

    talvezBau(dt);

    if (progresso >= 1) fisgou();
    else if (progresso <= 0) escapou();
  }

  function fisgou() {
    estado = "pegou";
    total += peixe.pontos;
    caught[peixe.nome] = (caught[peixe.nome] || 0) + 1;
    bau = null;
    msg.textContent = `Pegou! ${peixe.emoji} ${peixe.nome} (+${peixe.pontos})`;
    document.getElementById("fish-next").hidden = false;
    document.getElementById("fish-stop").hidden = false;
  }

  function escapou() {
    encerrar(`${peixe.emoji} escapou… a pescaria acabou.`);
  }

  function draw() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#BFE3F5"); grad.addColorStop(1, "#3F7EA6");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // bolhinhas de fundo
    ctx.fillStyle = "rgba(255,255,255,.12)";
    for (let i = 0; i < 10; i++) {
      const y = (H - ((performance.now() * 0.02 + i * 97) % (H + 40))) - 20;
      ctx.beginPath(); ctx.arc((i * 79 + 33) % W, y, 3 + (i % 3) * 2, 0, Math.PI * 2); ctx.fill();
    }

    if (estado === "pescando") {
      ctx.fillStyle = "rgba(255,255,255,.32)";
      ctx.fillRect(TRX, 6, TRW, H - 12);
      ctx.fillStyle = "rgba(126,200,160,.85)";
      ctx.fillRect(TRX, barY, TRW, BAR_H);

      // baú 📦 com anel de coleta
      if (bau) {
        const resta = Math.max(0, bau.someEm - performance.now()) / (F.bauDuracaoMs ?? 4500);
        ctx.globalAlpha = resta < 0.25 ? 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 90)) : 1;
        ctx.font = "30px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("📦", TRX + TRW / 2, bau.y);
        const frac = bau.seguradoMs / (F.bauSegurarMs ?? 500);
        if (frac > 0) {
          ctx.strokeStyle = "#FFE55C"; ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(TRX + TRW / 2, bau.y, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.textBaseline = "alphabetic";
      }
    }

    ctx.textAlign = "center";
    if (estado === "pescando") {
      ctx.font = "30px system-ui, sans-serif";
      ctx.fillText(peixe ? peixe.emoji : "🐟", TRX + TRW / 2, fishY + 10);
    } else if (estado === "esperando") {
      ctx.font = "34px system-ui, sans-serif";
      ctx.fillText("🎣", W / 2, H / 2);
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.9)";
      const p = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
      ctx.fillText(`aguardando${p}`, W / 2, H / 2 + 36);
    } else if (estado === "mordendo") {
      ctx.font = "bold 60px system-ui, sans-serif";
      ctx.fillStyle = "#FFE55C";
      ctx.fillText("❗", W / 2, H / 2 + 14);
    }

    if (estado === "pescando") {
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.fillRect(W - 22, 6, 12, H - 12);
      const h = (H - 12) * progresso;
      ctx.fillStyle = progresso > 0.6 ? "#7EC8A0" : progresso > 0.3 ? "#FFD36B" : "#E38C7A";
      ctx.fillRect(W - 22, H - 6 - h, 12, h);
    }

    // placar da pescaria
    ctx.textAlign = "left";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillText(`${total} pts · 📦 ${baus}`, 14, 30);
    ctx.textAlign = "right"; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fillText(`🏆 ${getRecord("fishing")}`, W - 14, 30);
  }

  function loop(t) {
    const dt = lastT ? Math.min(3, ((t - lastT) / 1000) * 60) : 1;
    lastT = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* controles */
  const seg = (e) => {
    e.preventDefault();
    if (estado === "mordendo") { começarLuta(); return; }
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

  async function encerrar(motivo) {
    estado = "fim";
    document.getElementById("fish-next").hidden = true;
    document.getElementById("fish-stop").hidden = true;

    // registra o caderno da casa mesmo que a última tenha escapado
    if (Object.keys(caught).length) logFish(caught).catch(() => {});

    const bonusBau = baus * (F.bauCoins ?? 5);
    if (total > 0 || bonusBau > 0) {
      const meuRun = runId;
      const r = await rewardGame(getActiveBaby(), "fishing", total, null, bonusBau);
      if (meuRun !== runId) return;   // o jogador já recomeçou: não mexe na tela
      registerCare();
      msg.textContent = `${motivo} ` + (r.factor === 0 && bonusBau === 0
        ? `(${total} pts — a criança se cansou.)`
        : `${r.record ? "🏆 NOVO RECORDE! " : ""}${total} pts · 📦${baus} · +${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`);
    } else {
      msg.textContent = `${motivo} Nenhum peixe desta vez.`;
    }
    info.textContent = "Toque em “Jogar a linha” para recomeçar.";
    total = 0; caught = {}; baus = 0; bau = null;
    document.getElementById("fish-cast").hidden = false;
  }

  document.getElementById("fish-stop").onclick = () => encerrar("Pescaria guardada.");

  document.getElementById("fish-cast").onclick = () => {
    document.getElementById("fish-cast").hidden = true;
    total = 0; caught = {}; baus = 0;
    lancar();
  };

  /* ---- caderno de peixes (fishlog da casa, sincronizado) ---- */
  const log = document.getElementById("fish-log");
  const logBtn = document.getElementById("fish-log-btn");
  if (logBtn && log) {
    logBtn.onclick = () => {
      const dados = (window.__STATE__ && window.__STATE__.fishlog) || {};
      const list = document.getElementById("fish-log-list");
      list.innerHTML = "";
      let algum = false;
      for (const p of PEIXES) {
        const n = dados[p.nome] || 0;
        const row = document.createElement("div");
        row.className = "fish-log-row" + (n ? "" : " nunca");
        row.innerHTML = `<span class="flr-emoji">${n ? p.emoji : "❓"}</span>
          <span class="flr-nome">${n ? p.nome : "???"}</span>
          <span class="flr-qtd">${n ? "×" + n : "—"}</span>`;
        list.appendChild(row);
        if (n) algum = true;
      }
      if (!algum) {
        const p = document.createElement("p");
        p.className = "hint";
        p.textContent = "Nenhum peixe registrado ainda. Boa pesca!";
        list.appendChild(p);
      }
      log.hidden = false;
    };
    document.getElementById("fish-log-close").onclick = () => { log.hidden = true; };
  }

  /* ---- ciclo de vida: sair = zerar tudo ---- */
  function resetTela() {
    runId++;                      // nova partida: invalida recompensas pendentes
    medidas();
    estado = "fim"; total = 0; caught = {}; baus = 0; bau = null; bauSorteado = false;
    segurando = false; lastT = 0;
    peixe = PEIXES[0];
    barY = H - BAR_H - 10; fishY = H / 2; progresso = 0.35;
    document.getElementById("fish-next").hidden = true;
    document.getElementById("fish-stop").hidden = true;
    document.getElementById("fish-cast").hidden = false;
    if (log) log.hidden = true;
    info.textContent = "Segure para subir a rede e mantenha o peixe dentro.";
    msg.textContent = "";
  }

  view.onResize = () => { medidas(); };
  onScreenShown("screen-fishing", resetTela);
  onScreenLeft("screen-fishing", resetTela);
  resetTela();
  requestAnimationFrame(loop);
}
