/* =====================================================================
 * touch.js — SISTEMA TÁTIL DE AFETO (cabeça, carinho, corpo, cócegas)
 * ---------------------------------------------------------------------
 * O Afeto (love) sobe tocando e deslizando no bebê, por zonas:
 *   - CABEÇA (topo):  tapinha carinhoso → afeto + "balancinho"
 *   - CORPO (meio):   carinho deslizando → afeto
 *   - BARRIGA (base): cócegas → afeto + risadinha + estremecer
 *
 * O ganho é acumulado localmente e enviado ao Firebase em lotes
 * (throttle), pra não floodar o banco. Cada bebê é tocado no seu
 * próprio palco (a função é ligada por card em game.js).
 *
 * ÁUDIO: tenta tocar assets/audio/laugh.mp3; se não existir, sintetiza
 * uma risadinha com Web Audio. Largue o .mp3 na pasta quando tiver.
 * ===================================================================== */

import { addLove } from "./firebase-sync.js";
import { BALANCE } from "./config.js";
import { registerCare } from "./streak.js";

const LOVE_PER_PX   = BALANCE.care.lovePerPixel;   // ver balance.js
const MAX_PER_FLUSH = 8;      // teto de afeto enviado por lote
const FLUSH_MS      = 700;    // intervalo de envio ao banco
const GIGGLE_MS     = 1200;   // intervalo mínimo entre risadinhas
const BUBBLE_MS     = 350;    // intervalo entre bolhas de feedback

/* ---------------- áudio da risada ---------------- */
let laughEl = null, laughOk = false, actx = null;
try {
  laughEl = new Audio("assets/audio/laugh.mp3");
  laughEl.addEventListener("canplaythrough", () => (laughOk = true));
  laughEl.addEventListener("error", () => (laughOk = false));
} catch (_) {}

function synthGiggle() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const now = actx.currentTime;
    [0, 0.11, 0.22, 0.32].forEach((t, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(720 + i * 110 + Math.random() * 40, now + t);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.14, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.1);
      o.connect(g).connect(actx.destination);
      o.start(now + t); o.stop(now + t + 0.12);
    });
  } catch (_) {}
}

function playGiggle() {
  if (laughOk) { laughEl.currentTime = 0; laughEl.play().catch(synthGiggle); }
  else synthGiggle();
}

/* ---------------- feedback visual ---------------- */
function spawnBubble(stage, x, y, text) {
  const b = document.createElement("span");
  b.className = "love-bubble";
  b.textContent = text;
  b.style.left = `${x}px`;
  b.style.top = `${y}px`;
  stage.appendChild(b);
  setTimeout(() => b.remove(), 900);
}

function zoneOf(y, h) {
  if (y < h * 0.38) return "head";
  if (y > h * 0.66) return "belly";
  return "body";
}

/* ---------------- liga o toque num palco ---------------- */
export function attachTouch(stage, babyId) {
  let active = false, pointerId = null;
  let lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0, moved = 0;
  let pending = 0, lastFlush = 0, lastGiggle = 0, lastBubble = 0;

  const babyLayer = stage.querySelector(".baby-doll");

  function flush(force) {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    const add = Math.min(MAX_PER_FLUSH, Math.floor(pending));
    if (add > 0) { addLove(babyId, add); pending -= add; registerCare(); }
    lastFlush = now;
  }

  function onDown(e) {
    active = true; pointerId = e.pointerId;
    const r = stage.getBoundingClientRect();
    lastX = downX = e.clientX - r.left;
    lastY = downY = e.clientY - r.top;
    downT = Date.now(); moved = 0;
    stage.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!active || e.pointerId !== pointerId) return;
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const d = Math.hypot(x - lastX, y - lastY);
    lastX = x; lastY = y; moved += d;
    pending += d * LOVE_PER_PX;

    const now = Date.now();
    const zone = zoneOf(y, r.height);

    if (zone === "belly" && now - lastGiggle > GIGGLE_MS && d > 2) {
      lastGiggle = now;
      playGiggle();
      babyLayer?.classList.add("tickle");
      setTimeout(() => babyLayer?.classList.remove("tickle"), 320);
    }
    if (now - lastBubble > BUBBLE_MS && d > 2) {
      lastBubble = now;
      spawnBubble(stage, x, y, zone === "belly" ? "hihi!" : "❤");
    }
    flush(false);
    e.preventDefault();
  }

  function onUp(e) {
    if (!active) return;
    const dt = Date.now() - downT;
    // Tapinha curto na cabeça = carinho na cabeça (balancinho).
    if (moved < 12 && dt < 400) {
      const r = stage.getBoundingClientRect();
      if (zoneOf(downY, r.height) === "head") {
        pending += 4;
        babyLayer?.classList.add("patted");
        setTimeout(() => babyLayer?.classList.remove("patted"), 300);
        spawnBubble(stage, downX, downY, "❤");
      }
    }
    active = false; pointerId = null;
    flush(true);
  }

  stage.style.touchAction = "none";
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  stage.addEventListener("pointerleave", onUp);
}
